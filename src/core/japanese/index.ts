/**
 * Japanese readings — the opt-in offline dictionary (kuromoji + IPADIC) that
 * resolves kanji for lyrics labels and title matching.
 *
 * - `dictionary-manager.ts` — download / verify / remove, lazy tokenizer;
 * - `reader.ts` — hiragana and romaji of a line;
 * - `tokenizer.ts` — kuromoji's loader rebuilt for React Native.
 */
import { createStore } from "@/core/external-store";
import {
  JAPANESE_DICTIONARY_INITIAL,
  JapaneseDictionary,
  type JapaneseDictionarySnapshot,
} from "@/core/japanese/dictionary-manager";
import { DictionaryFileStorage } from "@/core/japanese/file-storage";
import type { Romanizer } from "@/core/lyrics/text";

export const japaneseDictionaryStore = createStore<JapaneseDictionarySnapshot>(JAPANESE_DICTIONARY_INITIAL);

export const dictionaryStorage = new DictionaryFileStorage();

/**
 * App-wide dictionary (composition root). kuromoji and the inflater load on
 * first use: someone who never installs the dictionary never runs them.
 */
export const japaneseDictionary = new JapaneseDictionary({
  storage: dictionaryStorage,
  store: japaneseDictionaryStore,
  buildTokenizer: async (load) => (await import("@/core/japanese/tokenizer")).buildTokenizer(load),
  unpack: async (...args) => (await import("@/core/japanese/unpack")).gunzipTrimmed(...args),
});

/** The reader's readings, once loaded (`null` before). */
export const japaneseReader = {
  romanizer(): Romanizer | null {
    const reader = japaneseDictionary.currentReader;
    return reader ? (text) => reader.romaji(text) : null;
  },
};

export { DICTIONARY_BYTES, DICTIONARY_STORED_BYTES } from "@/core/japanese/dictionary";
export type { JapaneseReader } from "@/core/japanese/reader";
export type { JapaneseDictionarySnapshot, DictionaryInstall, ReaderStatus } from "@/core/japanese/dictionary-manager";
