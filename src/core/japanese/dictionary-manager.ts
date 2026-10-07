import type { ExternalStore } from "@/core/external-store";
import {
  DICTIONARY_BYTES,
  DICTIONARY_FILE_NAMES,
  DICTIONARY_FILES,
  DICTIONARY_MIRRORS,
  DICTIONARY_VERSION,
  type DictionaryFileName,
} from "@/core/japanese/dictionary";
import { JapaneseReader } from "@/core/japanese/reader";
import type { JapaneseTokenizer, LoadFile } from "@/core/japanese/tokenizer";
import { gunzipTrimmed, padTo } from "@/core/japanese/unpack";
import { debugLog } from "@/utils/player.config";

/** `none` → `downloading` (download + unpack) → `installed`, or `error` (retryable). */
export type DictionaryInstall = "none" | "downloading" | "installed" | "error";
/** The in-memory tokenizer, built while lyrics need it. */
export type ReaderStatus = "idle" | "loading" | "ready" | "error";

export type JapaneseDictionarySnapshot = {
  install: DictionaryInstall;
  /** 0..1 while installing: half download, half unpacking. */
  progress: number;
  reader: ReaderStatus;
};

export const JAPANESE_DICTIONARY_INITIAL: JapaneseDictionarySnapshot = {
  install: "none",
  progress: 0,
  reader: "idle",
};

/** The dictionary's files on the device (expo-file-system in the app). */
export interface DictionaryStorage {
  /** Size and MD5 of a downloaded `.gz`, `null` when absent. */
  statDownload(name: DictionaryFileName): Promise<{ bytes: number; md5: string | null } | null>;
  download(url: string, name: DictionaryFileName, onBytes: (written: number) => void): Promise<void>;
  readDownload(name: DictionaryFileName): Promise<Uint8Array>;
  removeDownload(name: DictionaryFileName): Promise<void>;
  /** Size of an unpacked, stored file, `null` when absent. */
  statStored(name: DictionaryFileName): Promise<number | null>;
  writeStored(name: DictionaryFileName, bytes: Uint8Array): Promise<void>;
  readStored(name: DictionaryFileName): Promise<Uint8Array>;
  readVersion(): Promise<string | null>;
  writeVersion(version: string): Promise<void>;
  removeAll(): Promise<void>;
}

export interface JapaneseDictionaryDeps {
  storage: DictionaryStorage;
  store: ExternalStore<JapaneseDictionarySnapshot>;
  buildTokenizer: (load: LoadFile) => Promise<JapaneseTokenizer>;
  /** Inflates a verified `.gz` (yielding as it goes) without its padding. */
  unpack?: typeof gunzipTrimmed;
}

/**
 * The opt-in Japanese dictionary: download (verified file by file against
 * the published package), a one-time unpack, removal, and the tokenizer
 * behind kanji readings — built only while lyrics need it, and dropped
 * after (it holds ~100 MB).
 */
export class JapaneseDictionary {
  private reader: JapaneseReader | null = null;
  private installing: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private restored: Promise<void> | null = null;
  /** Bumped by unload/remove: a build that finishes later is dropped. */
  private generation = 0;
  private readonly unpack: typeof gunzipTrimmed;

  constructor(private readonly deps: JapaneseDictionaryDeps) {
    this.unpack = deps.unpack ?? gunzipTrimmed;
  }

  get snapshot(): JapaneseDictionarySnapshot {
    return this.deps.store.getSnapshot();
  }

  /** The loaded reader, or `null` until {@link loadReader} finished. */
  get currentReader(): JapaneseReader | null {
    return this.reader;
  }

  /** Whether a previous install is complete on disk (once per session). */
  restore(): Promise<void> {
    this.restored ??= this.checkInstalled()
      .then((installed) => {
        if (installed && this.snapshot.install === "none") this.update({ install: "installed", progress: 1 });
      })
      .catch((error) => console.warn("[JapaneseDictionary] restore:", error));
    return this.restored;
  }

  /** Downloads, verifies and unpacks every file; concurrent calls share one run. */
  install(): Promise<void> {
    this.installing ??= this.runInstall().finally(() => {
      this.installing = null;
    });
    return this.installing;
  }

  /** Deletes the files and drops the reader. */
  async remove(): Promise<void> {
    await this.installing?.catch(() => {});
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

  /** Lets the reader's ~100 MB go (lyrics closed); the next load rebuilds it. */
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
    for (const name of DICTIONARY_FILE_NAMES) {
      if ((await this.deps.storage.statStored(name)) !== DICTIONARY_FILES[name].stored) return false;
    }
    return true;
  }

  private async downloadVerified(name: DictionaryFileName): Promise<boolean> {
    const stat = await this.deps.storage.statDownload(name);
    const expected = DICTIONARY_FILES[name];
    return stat?.bytes === expected.bytes && stat.md5 === expected.md5;
  }

  private async runInstall(): Promise<void> {
    if (this.snapshot.install === "installed") return;
    this.update({ install: "downloading", progress: 0 });
    // Half the bar is the download, half the unpacking (both by `.gz` bytes).
    let done = 0;
    const report = (extra: number) => {
      const progress = (done + extra) / (2 * DICTIONARY_BYTES);
      if (progress - this.snapshot.progress >= 0.01) this.update({ progress });
    };
    try {
      for (const name of DICTIONARY_FILE_NAMES) {
        // react-doctor-disable-next-line async-await-in-loop -- one file at a time: unpacking holds up to 42 MB.
        await this.installFile(name, (extra) => report(extra));
        done += 2 * DICTIONARY_FILES[name].bytes;
        report(0);
      }
      await this.deps.storage.writeVersion(DICTIONARY_VERSION);
      this.update({ install: "installed", progress: 1 });
    } catch (error) {
      console.warn("[JapaneseDictionary] install failed:", error);
      this.update({ install: "error" });
    }
  }

  /**
   * One file: downloaded and verified (unless an interrupted install left it),
   * unpacked, stored, its download removed. Progress reports this file's
   * share: the download, then the unpacking (both in `.gz` bytes).
   */
  private async installFile(name: DictionaryFileName, report: (extra: number) => void): Promise<void> {
    const file = DICTIONARY_FILES[name];
    if ((await this.deps.storage.statStored(name)) === file.stored) return;
    if (!(await this.downloadVerified(name))) await this.downloadFromMirrors(name, report);
    const unpacked = await this.unpack(await this.deps.storage.readDownload(name), file.unpacked, (unpackedBytes) =>
      report(file.bytes + unpackedBytes),
    );
    if (unpacked.length !== file.stored) throw new Error(`${name}: unexpected content`);
    await this.deps.storage.writeStored(name, unpacked);
    await this.deps.storage.removeDownload(name);
  }

  /** Tries each mirror until one serves the exact published file. */
  private async downloadFromMirrors(name: DictionaryFileName, report: (extra: number) => void): Promise<void> {
    let lastError: unknown = new Error(`${name}: no mirror`);
    for (const mirror of DICTIONARY_MIRRORS) {
      try {
        await this.deps.storage.download(`${mirror}${name}`, name, (written) =>
          report(Math.min(written, DICTIONARY_FILES[name].bytes)),
        );
        if (await this.downloadVerified(name)) return;
        lastError = new Error(`${name}: checksum mismatch from ${mirror}`);
      } catch (error) {
        lastError = error;
      }
      await this.deps.storage.removeDownload(name).catch(() => {});
    }
    throw lastError;
  }

  private async runLoad(): Promise<void> {
    const generation = this.generation;
    const started = Date.now();
    this.update({ reader: "loading" });
    try {
      const tokenizer = await this.deps.buildTokenizer(async (name) =>
        padTo(await this.deps.storage.readStored(name), DICTIONARY_FILES[name].unpacked),
      );
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
