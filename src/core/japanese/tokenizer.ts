import DynamicDictionaries from "kuromoji/src/dict/DynamicDictionaries";
import Tokenizer from "kuromoji/src/Tokenizer";
import { Zlib } from "zlibjs/bin/gunzip.min.js";
import type { DictionaryFileName } from "@/core/japanese/dictionary";

// ─── kuromoji on React Native ───
//
// kuromoji's own loader needs Node's `path`/`fs` (or XHR in browsers); its
// dictionary and tokenizer classes are plain JS. This rebuilds the loader's
// steps around them: gunzip each IPADIC file (zlibjs) and hand the typed
// arrays over in the order kuromoji expects.

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

export type LoadFile = (name: DictionaryFileName) => Promise<Uint8Array>;

const gunzip = (bytes: Uint8Array): ArrayBuffer => {
  const out = new Zlib.Gunzip(bytes).decompress();
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
};

/** Builds the tokenizer from the downloaded IPADIC files (seconds, on the JS thread). */
export async function buildTokenizer(load: LoadFile): Promise<JapaneseTokenizer> {
  const read = async (name: DictionaryFileName) => gunzip(await load(name));
  const dictionaries = new DynamicDictionaries();

  const [base, check] = await Promise.all([read("base.dat.gz"), read("check.dat.gz")]);
  dictionaries.loadTrie(new Int32Array(base), new Int32Array(check));

  const [tokenInfo, posTags, targetMap] = await Promise.all([
    read("tid.dat.gz"),
    read("tid_pos.dat.gz"),
    read("tid_map.dat.gz"),
  ]);
  dictionaries.loadTokenInfoDictionaries(
    new Uint8Array(tokenInfo),
    new Uint8Array(posTags),
    new Uint8Array(targetMap),
  );

  dictionaries.loadConnectionCosts(new Int16Array(await read("cc.dat.gz")));

  const [unk, unkPos, unkMap, unkChar, unkCompat, unkInvoke] = await Promise.all([
    read("unk.dat.gz"),
    read("unk_pos.dat.gz"),
    read("unk_map.dat.gz"),
    read("unk_char.dat.gz"),
    read("unk_compat.dat.gz"),
    read("unk_invoke.dat.gz"),
  ]);
  dictionaries.loadUnknownDictionaries(
    new Uint8Array(unk),
    new Uint8Array(unkPos),
    new Uint8Array(unkMap),
    new Uint8Array(unkChar),
    new Uint32Array(unkCompat),
    new Uint8Array(unkInvoke),
  );

  return new Tokenizer(dictionaries) as unknown as JapaneseTokenizer;
}
