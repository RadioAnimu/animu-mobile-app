import { useEffect, useSyncExternalStore } from "react";
import { File, Directory, Paths } from "expo-file-system";
import {
  DICT_VERSION,
  JapaneseDictionaryManager,
  type DictionaryFileSystem,
} from "./dictionary-manager";
import {
  JAPANESE_DICT_INITIAL,
  japaneseDictStore,
  type JapaneseDictSnapshot,
} from "./dictionary-store";
import { setJapaneseEngine } from "./engine";
import { buildKuromojiTokenizer } from "./tokenizer-factory";

// ─── Japanese dictionary barrel (React Native wiring) ───
//
// Binds the manager to expo-file-system (SDK 54 File/Directory API) and
// the real kuromoji build. CDNs serve the upstream npm package's dict
// folder; jsDelivr first, unpkg as a per-file fallback.

export const DICT_DIR = "japanese-dict/ipadic-0.1.2";

const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/",
  "https://unpkg.com/kuromoji@0.1.2/dict/",
];

const file = (...parts: string[]) => new File(Paths.document, ...parts);

const expoFileSystem: DictionaryFileSystem = {
  async makeDir(relativeDir) {
    const dir = new Directory(Paths.document, relativeDir);
    if (!dir.exists) dir.create({ idempotent: true });
  },

  async removeDir(relativeDir) {
    const dir = new Directory(Paths.document, relativeDir);
    if (dir.exists) dir.delete();
  },

  async fileExists(relativeDir, fileName) {
    return file(relativeDir, fileName).exists;
  },

  async downloadFile(url, relativeDir, fileName) {
    const dir = new Directory(Paths.document, relativeDir);
    if (!dir.exists) dir.create({ idempotent: true });
    await File.downloadFileAsync(url, new File(dir, fileName), {
      idempotent: true,
    });
  },

  async readFileBytes(relativeDir, fileName) {
    return file(relativeDir, fileName).bytes();
  },

  async writeFileText(relativeDir, fileName, content) {
    const target = file(relativeDir, fileName);
    if (!target.exists) target.create();
    target.write(content);
  },

  async readFileText(relativeDir, fileName) {
    const target = file(relativeDir, fileName);
    return target.exists ? await target.text() : null;
  },
};

export const japaneseDictionaryManager = new JapaneseDictionaryManager({
  fs: expoFileSystem,
  cdnUrls: CDN_URLS,
  dictVersion: DICT_VERSION,
  dictDir: DICT_DIR,
  buildTokenizer: buildKuromojiTokenizer,
  onEngine: setJapaneseEngine,
});

export { DICT_FILES, DICT_VERSION } from "./dictionary-manager";
export { japaneseDictStore, JAPANESE_DICT_INITIAL } from "./dictionary-store";
export type { JapaneseDictSnapshot } from "./dictionary-store";

let restoreStarted = false;

/** Dictionary state + one-time reconciliation with disk after startup. */
export function useJapaneseDictionary(): JapaneseDictSnapshot {
  const snapshot = useSyncExternalStore(
    japaneseDictStore.subscribe,
    japaneseDictStore.getSnapshot,
    () => JAPANESE_DICT_INITIAL,
  );

  useEffect(() => {
    if (!restoreStarted) {
      restoreStarted = true;
      void japaneseDictionaryManager.restore();
    }
  }, []);

  return snapshot;
}
