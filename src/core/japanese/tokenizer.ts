import DynamicDictionaries from "kuromoji/src/dict/DynamicDictionaries";
import Tokenizer from "kuromoji/src/Tokenizer";
import type { DictionaryFileName } from "@/core/japanese/dictionary";
import { yieldToEventLoop } from "@/core/japanese/unpack";

// ─── kuromoji on React Native ───
//
// kuromoji's own loader needs Node's `path`/`fs` (or XHR) and gunzips in JS;
// its dictionary and tokenizer classes are plain JS. This rebuilds the
// loader's steps around them from the already-unpacked files, yielding to the
// event loop between steps so the build never holds the JS thread for long.

/** A kuromoji token, as far as readings go. */
export interface KuromojiToken {
  surface_form: string;
  /** Part of speech (IPADIC, Japanese: 名詞, 助詞, 助動詞…). */
  pos: string;
  pos_detail_1: string;
  /** Katakana reading (`*` or missing for unknown words). */
  reading?: string;
  /** Katakana as pronounced (は particle → ワ, long vowels as ー). */
  pronunciation?: string;
}

export interface JapaneseTokenizer {
  tokenize(text: string): KuromojiToken[];
}

/** An unpacked dictionary file, at its published (padded) size. */
export type LoadFile = (name: DictionaryFileName) => Promise<Uint8Array>;

/** The bytes' own buffer when they span it (no 40 MB copy), else a copy. */
const view = (bytes: Uint8Array): ArrayBuffer =>
  (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) as ArrayBuffer;

/** Builds the tokenizer from the unpacked IPADIC files, step by step. */
export async function buildTokenizer(
  load: LoadFile,
  yieldNow: () => Promise<void> = yieldToEventLoop,
): Promise<JapaneseTokenizer> {
  const read = async (name: DictionaryFileName) => view(await load(name));
  const dictionaries = new DynamicDictionaries();

  dictionaries.loadTrie(new Int32Array(await read("base.dat.gz")), new Int32Array(await read("check.dat.gz")));
  await yieldNow();

  const tokenInfo = new Uint8Array(await read("tid.dat.gz"));
  const posTags = new Uint8Array(await read("tid_pos.dat.gz"));
  const targetMap = new Uint8Array(await read("tid_map.dat.gz"));
  dictionaries.loadTokenInfoDictionaries(tokenInfo, posTags, targetMap);
  await yieldNow();

  dictionaries.loadConnectionCosts(new Int16Array(await read("cc.dat.gz")));
  await yieldNow();

  dictionaries.loadUnknownDictionaries(
    new Uint8Array(await read("unk.dat.gz")),
    new Uint8Array(await read("unk_pos.dat.gz")),
    new Uint8Array(await read("unk_map.dat.gz")),
    new Uint8Array(await read("unk_char.dat.gz")),
    new Uint32Array(await read("unk_compat.dat.gz")),
    new Uint8Array(await read("unk_invoke.dat.gz")),
  );
  return new Tokenizer(dictionaries) as unknown as JapaneseTokenizer;
}
