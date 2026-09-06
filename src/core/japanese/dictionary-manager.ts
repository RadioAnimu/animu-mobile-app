import {
  katakanaToHiragana,
  type JapaneseTransliterator,
} from "./engine";
import {
  japaneseDictStore,
  type JapaneseDictSnapshot,
} from "./dictionary-store";

// ─── Offline Japanese dictionary manager ───
//
// Owns the three lifecycles of the kuromoji/IPADIC dictionary:
// 1. download — the 12 gzipped IPADIC files onto local storage (opt-in
//    from Settings, ~17 MB, with a manifest for integrity);
// 2. removal — delete everything and uninstall the engine;
// 3. tokenizer build — the heavy in-memory parse, run lazily on the
//    first Japanese song after a download (never at startup).
//
// Filesystem and tokenizer construction are injected so the whole flow
// is unit-testable and the RN-only bindings stay in the barrel.

export const DICT_FILES = [
  "base.dat.gz",
  "check.dat.gz",
  "tid.dat.gz",
  "tid_pos.dat.gz",
  "tid_map.dat.gz",
  "cc.dat.gz",
  "unk.dat.gz",
  "unk_pos.dat.gz",
  "unk_map.dat.gz",
  "unk_char.dat.gz",
  "unk_compat.dat.gz",
  "unk_invoke.dat.gz",
] as const;

export const DICT_VERSION = "ipadic-kuromoji-0.1.2";
export const MANIFEST_FILE = "manifest.json";

export interface KuromojiToken {
  surface_form?: string;
  reading?: string;
}

export interface MinimalTokenizer {
  tokenize(text: string): KuromojiToken[];
}

export interface DictionaryFileSystem {
  makeDir(relativeDir: string): Promise<void>;
  removeDir(relativeDir: string): Promise<void>;
  fileExists(relativeDir: string, fileName: string): Promise<boolean>;
  downloadFile(
    url: string,
    relativeDir: string,
    fileName: string,
  ): Promise<void>;
  readFileBytes(relativeDir: string, fileName: string): Promise<Uint8Array>;
  writeFileText(
    relativeDir: string,
    fileName: string,
    content: string,
  ): Promise<void>;
  readFileText(relativeDir: string, fileName: string): Promise<string | null>;
}

export type TokenizerFactory = (
  load: (fileName: string) => Promise<Uint8Array>,
) => Promise<MinimalTokenizer>;

interface DictionaryManifest {
  version: string;
  files: Record<string, number>;
}

export type JapaneseDictionaryDependencies = {
  fs: DictionaryFileSystem;
  /** Mirrors tried in order for every file. */
  cdnUrls: string[];
  dictVersion: string;
  dictDir: string;
  buildTokenizer: TokenizerFactory;
  onEngine: (engine: JapaneseTransliterator | null) => void;
};

export class JapaneseDictionaryManager {
  private readonly deps: JapaneseDictionaryDependencies;
  private downloadPromise: Promise<void> | null = null;
  private tokenizerPromise: Promise<void> | null = null;

  constructor(deps: JapaneseDictionaryDependencies) {
    this.deps = deps;
  }

  get snapshot(): JapaneseDictSnapshot {
    return japaneseDictStore.getSnapshot();
  }

  /**
   * Reconciles the store with what is actually on disk (after an app
   * restart the store boots as "none"). Idempotent.
   */
  async restore(): Promise<void> {
    if (this.snapshot.download === "downloading") return;
    try {
      const installed = await this.isInstalled();
      japaneseDictStore.update({
        download: installed ? "ready" : this.snapshot.download,
      });
    } catch {
      // A broken install is treated as "not downloaded" — Settings
      // offers the download again, which overwrites partial files.
    }
  }

  /** Downloads all dictionary files; concurrent calls share one run. */
  download(): Promise<void> {
    if (this.downloadPromise) return this.downloadPromise;
    this.downloadPromise = this.runDownload().finally(() => {
      this.downloadPromise = null;
    });
    return this.downloadPromise;
  }

  private async runDownload(): Promise<void> {
    japaneseDictStore.update({ download: "downloading", progress: 0 });

    try {
      await this.deps.fs.makeDir(this.deps.dictDir);
      const sizes: Record<string, number> = {};

      for (let index = 0; index < DICT_FILES.length; index += 1) {
        const fileName = DICT_FILES[index];
        await this.downloadOne(fileName);
        sizes[fileName] = 1;
        japaneseDictStore.update({
          progress: (index + 1) / DICT_FILES.length,
        });
      }

      await this.deps.fs.writeFileText(
        this.deps.dictDir,
        MANIFEST_FILE,
        JSON.stringify({ version: this.deps.dictVersion, files: sizes }),
      );
      japaneseDictStore.update({ download: "ready", progress: 1 });
    } catch (error) {
      console.error("[JapaneseDictionary] download failed:", error);
      japaneseDictStore.update({ download: "error" });
    }
  }

  private async downloadOne(fileName: string): Promise<void> {
    let lastError: unknown;
    for (const cdn of this.deps.cdnUrls) {
      try {
        await this.deps.fs.downloadFile(
          `${cdn}${fileName}`,
          this.deps.dictDir,
          fileName,
        );
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("download failed");
  }

  /** Deletes the dictionary and uninstalls the engine. */
  async remove(): Promise<void> {
    this.tokenizerPromise = null;
    this.deps.onEngine(null);
    japaneseDictStore.update({ tokenizer: "idle", download: "none", progress: 0 });
    try {
      await this.deps.fs.removeDir(this.deps.dictDir);
    } catch (error) {
      console.error("[JapaneseDictionary] remove failed:", error);
    }
  }

  /**
   * Builds the in-memory tokenizer when the dictionary is on disk.
   * Concurrent calls share one build; callers can re-invoke freely.
   */
  ensureTokenizer(): Promise<void> {
    if (this.tokenizerPromise) return this.tokenizerPromise;
    if (this.snapshot.download !== "ready") return Promise.resolve();
    if (this.snapshot.tokenizer === "ready") return Promise.resolve();

    this.tokenizerPromise = this.runTokenizerBuild().finally(() => {
      this.tokenizerPromise = null;
    });
    return this.tokenizerPromise;
  }

  private async runTokenizerBuild(): Promise<void> {
    japaneseDictStore.update({ tokenizer: "loading" });
    try {
      const tokenizer = await this.deps.buildTokenizer(async (fileName) =>
        this.deps.fs.readFileBytes(this.deps.dictDir, fileName),
      );
      this.deps.onEngine(kuromojiTransliterator(tokenizer));
      japaneseDictStore.update({ tokenizer: "ready" });
    } catch (error) {
      console.error("[JapaneseDictionary] tokenizer build failed:", error);
      this.deps.onEngine(null);
      japaneseDictStore.update({ tokenizer: "error" });
    }
  }

  private async isInstalled(): Promise<boolean> {
    const raw = await this.deps.fs.readFileText(
      this.deps.dictDir,
      MANIFEST_FILE,
    );
    if (!raw) return false;
    try {
      const manifest = JSON.parse(raw) as DictionaryManifest;
      if (manifest.version !== this.deps.dictVersion) return false;
      for (const fileName of DICT_FILES) {
        if (!(await this.deps.fs.fileExists(this.deps.dictDir, fileName))) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}

/** kuromoji tokens → full-line hiragana reading (romaji composes on top). */
export function kuromojiTransliterator(
  tokenizer: MinimalTokenizer,
): JapaneseTransliterator {
  const cache = new Map<string, string>();

  return {
    toHiragana(text: string): string {
      const hit = cache.get(text);
      if (hit !== undefined) return hit;

      // IPADIC carries readings in katakana — fold to hiragana for the
      // furigana view; romaji conversion happens downstream per mode.
      let reading = "";
      try {
        reading = tokenizer
          .tokenize(text)
          .map((token) => katakanaToHiragana(token.reading ?? token.surface_form ?? ""))
          .join("");
      } catch {
        reading = text;
      }

      cache.set(text, reading);
      return reading;
    },
  };
}
