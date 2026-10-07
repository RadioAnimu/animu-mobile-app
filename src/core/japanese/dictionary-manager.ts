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

/** `none` → `downloading` → `installed`, or `error` (retryable). */
export type DictionaryInstall = "none" | "downloading" | "installed" | "error";
/** The in-memory tokenizer, built on first use after an install. */
export type ReaderStatus = "idle" | "loading" | "ready" | "error";

export type JapaneseDictionarySnapshot = {
  install: DictionaryInstall;
  /** 0..1 while downloading (bytes). */
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
  /** Size and MD5 of a stored file, `null` when absent. */
  stat(name: DictionaryFileName, withMd5: boolean): Promise<{ bytes: number; md5: string | null } | null>;
  download(url: string, name: DictionaryFileName, onBytes: (written: number) => void): Promise<void>;
  remove(name: DictionaryFileName): Promise<void>;
  read: LoadFile;
  readVersion(): Promise<string | null>;
  writeVersion(version: string): Promise<void>;
  removeAll(): Promise<void>;
}

export interface JapaneseDictionaryDeps {
  storage: DictionaryStorage;
  store: ExternalStore<JapaneseDictionarySnapshot>;
  buildTokenizer: (load: LoadFile) => Promise<JapaneseTokenizer>;
}

/**
 * The opt-in Japanese dictionary: download (verified file by file against
 * the published package), removal, and the tokenizer behind kanji readings,
 * built lazily — never at startup, only when lyrics ask for it.
 */
export class JapaneseDictionary {
  private reader: JapaneseReader | null = null;
  private installing: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private restored: Promise<void> | null = null;

  constructor(private readonly deps: JapaneseDictionaryDeps) {}

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

  /** Downloads and verifies every file; concurrent calls share one run. */
  install(): Promise<void> {
    this.installing ??= this.runInstall().finally(() => {
      this.installing = null;
    });
    return this.installing;
  }

  /** Deletes the files and drops the reader. */
  async remove(): Promise<void> {
    await this.installing?.catch(() => {});
    this.reader = null;
    this.loading = null;
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

  private update(patch: Partial<JapaneseDictionarySnapshot>): void {
    this.deps.store.setSnapshot({ ...this.snapshot, ...patch });
  }

  private async checkInstalled(): Promise<boolean> {
    if ((await this.deps.storage.readVersion()) !== DICTIONARY_VERSION) return false;
    for (const name of DICTIONARY_FILE_NAMES) {
      const stat = await this.deps.storage.stat(name, false);
      if (stat?.bytes !== DICTIONARY_FILES[name].bytes) return false;
    }
    return true;
  }

  private async verified(name: DictionaryFileName): Promise<boolean> {
    const stat = await this.deps.storage.stat(name, true);
    const expected = DICTIONARY_FILES[name];
    return stat?.bytes === expected.bytes && stat.md5 === expected.md5;
  }

  private async runInstall(): Promise<void> {
    if (this.snapshot.install === "installed") return;
    this.update({ install: "downloading", progress: 0 });
    let done = 0;
    try {
      for (const name of DICTIONARY_FILE_NAMES) {
        // A file left by an interrupted install is kept if it checks out.
        if (!(await this.verified(name))) await this.downloadVerified(name, done);
        done += DICTIONARY_FILES[name].bytes;
        this.update({ progress: done / DICTIONARY_BYTES });
      }
      await this.deps.storage.writeVersion(DICTIONARY_VERSION);
      this.update({ install: "installed", progress: 1 });
    } catch (error) {
      console.warn("[JapaneseDictionary] install failed:", error);
      this.update({ install: "error" });
    }
  }

  /** Tries each mirror until one serves the exact published file. */
  private async downloadVerified(name: DictionaryFileName, doneBefore: number): Promise<void> {
    let lastError: unknown = new Error(`${name}: no mirror`);
    for (const mirror of DICTIONARY_MIRRORS) {
      try {
        await this.deps.storage.download(`${mirror}${name}`, name, (written) => {
          const progress = (doneBefore + Math.min(written, DICTIONARY_FILES[name].bytes)) / DICTIONARY_BYTES;
          if (progress - this.snapshot.progress >= 0.01) this.update({ progress });
        });
        if (await this.verified(name)) return;
        lastError = new Error(`${name}: checksum mismatch from ${mirror}`);
      } catch (error) {
        lastError = error;
      }
      await this.deps.storage.remove(name).catch(() => {});
    }
    throw lastError;
  }

  private async runLoad(): Promise<void> {
    this.update({ reader: "loading" });
    try {
      const tokenizer = await this.deps.buildTokenizer((name) => this.deps.storage.read(name));
      // Removed while building: drop the result.
      if (this.snapshot.install !== "installed") return;
      this.reader = new JapaneseReader(tokenizer);
      this.update({ reader: "ready" });
    } catch (error) {
      console.warn("[JapaneseDictionary] tokenizer build failed:", error);
      this.update({ reader: "error" });
    }
  }
}
