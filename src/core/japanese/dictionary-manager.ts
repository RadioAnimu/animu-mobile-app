import type { ExternalStore } from "@/core/external-store";
import {
  DICTIONARY_BYTES,
  DICTIONARY_FILE_NAMES,
  DICTIONARY_FILES,
  DICTIONARY_MIRRORS,
  DICTIONARY_STORED_BYTES,
  DICTIONARY_VERSION,
  type DictionaryFileName,
} from "@/core/japanese/dictionary";
import { JapaneseReader } from "@/core/japanese/reader";
import type { JapaneseTokenizer, LoadFile } from "@/core/japanese/tokenizer";
import type { gunzipTrimmed } from "@/core/japanese/unpack";
import { debugLog } from "@/utils/player.config";

/** `none` → `downloading` (download + unpack) → `installed`, or `error` (retryable). */
export type DictionaryInstall = "none" | "downloading" | "installed" | "error";
/** The in-memory tokenizer, built while lyrics need it. */
export type ReaderStatus = "idle" | "loading" | "ready" | "error";
/** Why the last install failed: the device is full, or the network gave up. */
export type InstallFailure = "space" | "network";

export type JapaneseDictionarySnapshot = {
  install: DictionaryInstall;
  /** 0..1 while installing: half download, half unpacking. */
  progress: number;
  reader: ReaderStatus;
  /** Set while `install` is `error`. */
  failure: InstallFailure | null;
};

export const JAPANESE_DICTIONARY_INITIAL: JapaneseDictionarySnapshot = {
  install: "none",
  progress: 0,
  reader: "idle",
  failure: null,
};

/** Free space an install needs: what stays, plus the largest download in flight, plus room. */
export const INSTALL_FREE_BYTES =
  DICTIONARY_STORED_BYTES +
  Math.max(...DICTIONARY_FILE_NAMES.map((name) => DICTIONARY_FILES[name].bytes)) +
  16 * 1024 * 1024;
/** No bytes for this long: the connection is dead or crawling, start the file over (ms). */
export const STALL_MS = 20_000;
/** Waits between rounds over the mirrors: rides out a network switch or a short outage (ms). */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000] as const;

/** The dictionary's files on the device (expo-file-system in the app). */
export interface DictionaryStorage {
  /** Size and MD5 of a downloaded `.gz`, `null` when absent. */
  statDownload(name: DictionaryFileName): Promise<{ bytes: number; md5: string | null } | null>;
  /** Downloads to the `.gz` file; rejects on failure or when `signal` aborts. */
  download(
    url: string,
    name: DictionaryFileName,
    onBytes: (written: number) => void,
    signal: AbortSignal,
  ): Promise<void>;
  readDownload(name: DictionaryFileName): Promise<Uint8Array>;
  removeDownload(name: DictionaryFileName): Promise<void>;
  writeStored(name: DictionaryFileName, bytes: Uint8Array): Promise<void>;
  /** Size of an unpacked, stored file, `null` when absent. */
  statStored(name: DictionaryFileName): Promise<number | null>;
  readStored(name: DictionaryFileName): Promise<Uint8Array>;
  readVersion(): Promise<string | null>;
  writeVersion(version: string): Promise<void>;
  /** Deletes everything the dictionary ever wrote. */
  removeAll(): Promise<void>;
  /** Free space on the device (bytes). */
  freeBytes(): number;
}

export interface JapaneseDictionaryDeps {
  storage: DictionaryStorage;
  store: ExternalStore<JapaneseDictionarySnapshot>;
  buildTokenizer: (load: LoadFile) => Promise<JapaneseTokenizer>;
  /** Inflates a verified `.gz` (yielding as it goes) without its padding. */
  unpack: typeof gunzipTrimmed;
  wait?: (ms: number) => Promise<void>;
}

class Cancelled extends Error {
  constructor() {
    super("dictionary install cancelled");
  }
}

class NoSpace extends Error {
  constructor() {
    super("not enough free space for the dictionary");
  }
}

/**
 * The opt-in Japanese dictionary: download (verified file by file against
 * the published package, riding out stalls and network switches), a
 * one-time unpack, removal, and the tokenizer behind kanji readings — built
 * only while lyrics need it, and dropped after.
 *
 * An install completes or leaves nothing behind: a failure, a cancel, or an
 * app killed half-way (found by {@link restore}) deletes every file.
 */
export class JapaneseDictionary {
  private reader: JapaneseReader | null = null;
  private installing: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private restored: Promise<void> | null = null;
  /** Aborts the running install (cancel) — the current transfer included. */
  private abort: AbortController | null = null;
  /** Bumped by unload/remove: a build that finishes later is dropped. */
  private generation = 0;
  private readonly unpack: typeof gunzipTrimmed;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(private readonly deps: JapaneseDictionaryDeps) {
    this.unpack = deps.unpack;
    this.wait = deps.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get snapshot(): JapaneseDictionarySnapshot {
    return this.deps.store.getSnapshot();
  }

  /** The loaded reader, or `null` until {@link loadReader} finished. */
  get currentReader(): JapaneseReader | null {
    return this.reader;
  }

  /**
   * Once per session: an install complete on disk is adopted; anything else
   * there (an install the app was killed in, an older layout) is deleted.
   */
  restore(): Promise<void> {
    this.restored ??= (async () => {
      try {
        const installed = await this.checkInstalled();
        if (installed && this.snapshot.install === "none") this.update({ install: "installed", progress: 1 });
        if (!installed && this.snapshot.install !== "downloading") await this.deps.storage.removeAll();
      } catch (error) {
        console.warn("[JapaneseDictionary] restore:", error);
      }
    })();
    return this.restored;
  }

  /** Downloads, verifies and unpacks every file; concurrent calls share one run. */
  install(): Promise<void> {
    this.installing ??= this.runInstall().finally(() => {
      this.installing = null;
      this.abort = null;
    });
    return this.installing;
  }

  /** Stops a running install and deletes what it wrote. */
  async cancel(): Promise<void> {
    this.abort?.abort();
    await this.installing?.catch(() => {});
  }

  /** Deletes the files and drops the reader. */
  async remove(): Promise<void> {
    await this.cancel();
    this.unloadReader();
    this.deps.store.setSnapshot(JAPANESE_DICTIONARY_INITIAL);
    await this.deps.storage.removeAll();
  }

  /** Builds the tokenizer once installed; concurrent calls share one build. */
  loadReader(): Promise<void> {
    if (this.reader || this.snapshot.install !== "installed") return Promise.resolve();
    this.loading ??= this.runLoad().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** Lets the reader's memory go (lyrics closed); the next load rebuilds it. */
  unloadReader(): void {
    this.generation += 1;
    this.reader = null;
    this.loading = null;
    if (this.snapshot.reader !== "idle") this.update({ reader: "idle" });
  }

  private update(patch: Partial<JapaneseDictionarySnapshot>): void {
    this.deps.store.setSnapshot({ ...this.snapshot, ...patch });
  }

  private async checkInstalled(): Promise<boolean> {
    if ((await this.deps.storage.readVersion()) !== DICTIONARY_VERSION) return false;
    const sizes = await Promise.all(DICTIONARY_FILE_NAMES.map((name) => this.deps.storage.statStored(name)));
    return sizes.every((size, index) => size === DICTIONARY_FILES[DICTIONARY_FILE_NAMES[index]].stored);
  }

  private async runInstall(): Promise<void> {
    await this.restore();
    if (this.snapshot.install === "installed") return;
    const abort = new AbortController();
    this.abort = abort;
    this.update({ install: "downloading", progress: 0, failure: null });
    // Half the bar is the download, half the unpacking (both by `.gz` bytes).
    let done = 0;
    const report = (extra: number) => {
      const progress = (done + extra) / (2 * DICTIONARY_BYTES);
      if (progress - this.snapshot.progress >= 0.01) this.update({ progress });
    };
    try {
      if (this.deps.storage.freeBytes() < INSTALL_FREE_BYTES) throw new NoSpace();
      for (const name of DICTIONARY_FILE_NAMES) {
        // react-doctor-disable-next-line async-await-in-loop -- one file at a time: unpacking holds up to 42 MB.
        await this.installFile(name, report, abort.signal);
        done += 2 * DICTIONARY_FILES[name].bytes;
        report(0);
      }
      await this.deps.storage.writeVersion(DICTIONARY_VERSION);
      this.update({ install: "installed", progress: 1 });
    } catch (error) {
      // Nothing half-installed stays on the device.
      await this.deps.storage.removeAll().catch(() => {});
      if (error instanceof Cancelled || abort.signal.aborted) {
        this.update({ install: "none", progress: 0, failure: null });
        return;
      }
      console.warn("[JapaneseDictionary] install failed:", error);
      this.update({ install: "error", progress: 0, failure: error instanceof NoSpace ? "space" : "network" });
    }
  }

  /** One file: downloaded and verified, unpacked, stored; its download removed. */
  private async installFile(
    name: DictionaryFileName,
    report: (extra: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const file = DICTIONARY_FILES[name];
    await this.downloadVerified(name, report, signal);
    const unpacked = await this.unpack(await this.deps.storage.readDownload(name), file.unpacked, (unpackedBytes) => {
      if (signal.aborted) throw new Cancelled();
      report(file.bytes + unpackedBytes);
    });
    if (unpacked.length !== file.stored) throw new Error(`${name}: unexpected content`);
    await this.deps.storage.writeStored(name, unpacked);
    await this.deps.storage.removeDownload(name);
  }

  private async isVerified(name: DictionaryFileName): Promise<boolean> {
    const stat = await this.deps.storage.statDownload(name);
    const expected = DICTIONARY_FILES[name];
    return stat?.bytes === expected.bytes && stat.md5 === expected.md5;
  }

  /**
   * Rounds over the mirrors until one serves the exact published file,
   * waiting longer between rounds: a dropped connection, a Wi-Fi ↔ mobile
   * switch or a crawling link (see {@link STALL_MS}) costs a retry, not the
   * install. A mirror serving other bytes is dropped for good.
   */
  private async downloadVerified(
    name: DictionaryFileName,
    report: (extra: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const mirrors: string[] = [...DICTIONARY_MIRRORS];
    let lastError: unknown = new Error(`${name}: no mirror`);
    for (const delay of [0, ...RETRY_DELAYS_MS]) {
      if (mirrors.length === 0) break;
      if (delay > 0) await this.wait(delay);
      const round = await this.tryMirrors(name, mirrors, report, signal);
      if (round.verified) return;
      lastError = round.error;
      debugLog(`[JapaneseDictionary] ${name}: retrying after`, lastError);
    }
    throw lastError;
  }

  /** One round over the mirrors: verified, or the round's last error. */
  private async tryMirrors(
    name: DictionaryFileName,
    mirrors: string[],
    report: (extra: number) => void,
    signal: AbortSignal,
  ): Promise<{ verified: true } | { verified: false; error: unknown }> {
    let lastError: unknown = null;
    for (const mirror of [...mirrors]) {
      if (signal.aborted) throw new Cancelled();
      try {
        await this.transfer(`${mirror}${name}`, name, report, signal);
        if (await this.isVerified(name)) return { verified: true };
        mirrors.splice(mirrors.indexOf(mirror), 1);
        lastError = new Error(`${name}: checksum mismatch from ${mirror}`);
      } catch (error) {
        if (signal.aborted) throw new Cancelled();
        lastError = error;
      }
      await this.deps.storage.removeDownload(name).catch(() => {});
    }
    return { verified: false, error: lastError };
  }

  /** One download, aborted when no bytes arrive for {@link STALL_MS} or on cancel. */
  private async transfer(
    url: string,
    name: DictionaryFileName,
    report: (extra: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const attempt = new AbortController();
    const onCancel = () => attempt.abort();
    signal.addEventListener("abort", onCancel, { once: true });
    let lastBytesAt = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastBytesAt > STALL_MS) attempt.abort();
    }, 1_000);
    try {
      await this.deps.storage.download(
        url,
        name,
        (written) => {
          lastBytesAt = Date.now();
          report(Math.min(written, DICTIONARY_FILES[name].bytes));
        },
        attempt.signal,
      );
    } finally {
      clearInterval(watchdog);
      signal.removeEventListener("abort", onCancel);
    }
  }

  private async runLoad(): Promise<void> {
    const generation = this.generation;
    const started = Date.now();
    this.update({ reader: "loading" });
    try {
      const tokenizer = await this.deps.buildTokenizer((name) => this.deps.storage.readStored(name));
      // Unloaded or removed while building: drop the result.
      if (generation !== this.generation || this.snapshot.install !== "installed") return;
      this.reader = new JapaneseReader(tokenizer);
      this.update({ reader: "ready" });
      debugLog(`[JapaneseDictionary] reader ready in ${Date.now() - started} ms`);
    } catch (error) {
      console.warn("[JapaneseDictionary] tokenizer build failed:", error);
      if (generation === this.generation) this.update({ reader: "error" });
    }
  }
}
