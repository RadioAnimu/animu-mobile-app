import CharacterDefinition from "kuromoji/src/dict/CharacterDefinition";
import DynamicDictionaries from "kuromoji/src/dict/DynamicDictionaries";
import Tokenizer from "kuromoji/src/Tokenizer";
import { DICTIONARY_FILES, type DictionaryFileName } from "@/core/japanese/dictionary";
import { padTo, yieldToEventLoop } from "@/core/japanese/unpack";

// ─── kuromoji on React Native ───
//
// kuromoji's own loader needs Node's `path`/`fs` (or XHR) and gunzips in JS;
// its dictionary and tokenizer classes are plain JS. This rebuilds the
// loader around them from the stored (unpacked, unpadded) files:
// - the target maps — kuromoji's one heavy step, a loop over ~1 M integers —
//   are read here in ~8 ms steps that yield to the event loop;
// - files read by offset only within their data are handed over unpadded
//   (kuromoji reads 0 past a buffer's end; its padding added 20 MB of zeros
//   and ~150 000 empty character classes);
// - the trie, the connection costs and the category maps are indexed
//   directly, so they keep their published size.

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

/** A stored dictionary file: unpacked, without its trailing zero padding. */
export type LoadFile = (name: DictionaryFileName) => Promise<Uint8Array>;

/** Integers read per step of a target map before checking the clock. */
const STEP_INTS = 2_048;
/** JS time spent per step before yielding (ms). */
const BUDGET_MS = 8;

/** The bytes' own buffer when they span it (no copy), else a copy. */
const bufferOf = (bytes: Uint8Array): ArrayBuffer =>
  (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) as ArrayBuffer;

/** Little-endian int32 at `at`; bytes past the end (the padding) read as 0. */
function intReader(bytes: Uint8Array): (at: number) => number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return (at) => {
    if (at + 4 <= bytes.length) return view.getInt32(at, true);
    let value = 0;
    for (let i = 0; i < 4 && at + i < bytes.length; i += 1) value |= bytes[at + i] << (8 * i);
    return value;
  };
}

/**
 * Reads target-map entries (`[key][count][ids…]`) from `at` until about
 * {@link BUDGET_MS} has passed; returns where it stopped.
 */
function readEntries(bytes: Uint8Array, int: (at: number) => number, map: Record<number, number[]>, from: number): number {
  const started = Date.now();
  let at = from;
  let sinceCheck = 0;
  while (at < bytes.length) {
    const key = int(at);
    const count = int(at + 4);
    at += 8;
    if (count > 0) {
      const ids = (map[key] ??= []);
      for (let i = 0; i < count; i += 1, at += 4) ids.push(int(at));
    }
    sinceCheck += 2 + Math.max(0, count);
    if (sinceCheck >= STEP_INTS) {
      sinceCheck = 0;
      if (Date.now() - started >= BUDGET_MS) return at;
    }
  }
  return at;
}

/**
 * kuromoji's `loadTargetMap`, in steps: `{ key: [ids…] }` from
 * `[size][key][count][ids…]…` — reads past the end, where the padding was,
 * are 0, as in kuromoji's own reader.
 */
export async function readTargetMap(
  bytes: Uint8Array,
  yieldNow: () => Promise<void> = yieldToEventLoop,
): Promise<Record<number, number[]>> {
  const int = intReader(bytes);
  const map: Record<number, number[]> = {};
  let at = 4; // the leading key count is not needed
  while (at < bytes.length) {
    at = readEntries(bytes, int, map, at);
    await yieldNow();
  }
  return map;
}

/** Builds the tokenizer from the stored IPADIC files, step by step. */
export async function buildTokenizer(
  load: LoadFile,
  yieldNow: () => Promise<void> = yieldToEventLoop,
): Promise<JapaneseTokenizer> {
  const padded = async (name: DictionaryFileName) => padTo(await load(name), DICTIONARY_FILES[name].unpacked);
  const dictionaries = new DynamicDictionaries();

  dictionaries.loadTrie(
    new Int32Array(bufferOf(await padded("base.dat.gz"))),
    new Int32Array(bufferOf(await padded("check.dat.gz"))),
  );
  await yieldNow();

  const known = dictionaries.token_info_dictionary;
  known.loadDictionary(await load("tid.dat.gz"));
  known.loadPosVector(await load("tid_pos.dat.gz"));
  known.target_map = await readTargetMap(await load("tid_map.dat.gz"), yieldNow);

  dictionaries.loadConnectionCosts(new Int16Array(bufferOf(await padded("cc.dat.gz"))));
  await yieldNow();

  const unknown = dictionaries.unknown_dictionary;
  unknown.loadDictionary(await load("unk.dat.gz"));
  unknown.loadPosVector(await load("unk_pos.dat.gz"));
  unknown.target_map = await readTargetMap(await load("unk_map.dat.gz"), yieldNow);
  unknown.character_definition = CharacterDefinition.load(
    await padded("unk_char.dat.gz"),
    new Uint32Array(bufferOf(await padded("unk_compat.dat.gz"))),
    await load("unk_invoke.dat.gz"),
  );

  return new Tokenizer(dictionaries) as unknown as JapaneseTokenizer;
}
