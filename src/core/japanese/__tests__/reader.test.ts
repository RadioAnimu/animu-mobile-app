import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import DynamicDictionaries from "kuromoji/src/dict/DynamicDictionaries";
import Tokenizer from "kuromoji/src/Tokenizer";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DICTIONARY_FILE_NAMES, DICTIONARY_FILES, type DictionaryFileName } from "@/core/japanese/dictionary";
import { JapaneseReader } from "@/core/japanese/reader";
import { buildTokenizer, readTargetMap, type JapaneseTokenizer } from "@/core/japanese/tokenizer";

// The real IPADIC from the installed kuromoji package, unpacked with Node's
// zlib and stored as the app stores it (no trailing padding).
const dictDir = path.join(path.dirname(createRequire(import.meta.url).resolve("kuromoji/package.json")), "dict");
const unpacked = new Map<DictionaryFileName, Uint8Array>();
const trim = (bytes: Uint8Array) => {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  return bytes.slice(0, end);
};

/** kuromoji's own loading: every file at its published (padded) size. */
function referenceTokenizer(): JapaneseTokenizer {
  const file = (name: DictionaryFileName) => unpacked.get(name)!;
  const dictionaries = new DynamicDictionaries();
  dictionaries.loadTrie(new Int32Array(file("base.dat.gz").buffer), new Int32Array(file("check.dat.gz").buffer));
  dictionaries.loadTokenInfoDictionaries(file("tid.dat.gz"), file("tid_pos.dat.gz"), file("tid_map.dat.gz"));
  dictionaries.loadConnectionCosts(new Int16Array(file("cc.dat.gz").buffer));
  dictionaries.loadUnknownDictionaries(
    file("unk.dat.gz"),
    file("unk_pos.dat.gz"),
    file("unk_map.dat.gz"),
    file("unk_char.dat.gz"),
    new Uint32Array(file("unk_compat.dat.gz").buffer),
    file("unk_invoke.dat.gz"),
  );
  return new Tokenizer(dictionaries) as unknown as JapaneseTokenizer;
}

// Lyrics lines heard on the station, plus unknown words, Latin and symbols.
const CORPUS = [
  "君の名は",
  "夢を見ていた",
  "欲しいのさ あなたのすべてが",
  "愛に抱かれギラギラ 燃えてしまいたい",
  "このままずっと息を殺して",
  "変わらない未来 睨み続け 生きていたくはない",
  "No destiny ふさわしく無い",
  "こんなんじゃきっと物足りない",
  "全てがあるまま 振り返りもせず",
  "人気のない放課後の 廊下の隅 踊り場は",
  "DADDY! DADDY! DO!",
  "ﾊﾝｶｸｶﾀｶﾅとＺＥＮＫＡＫＵ、絵文字🎵も",
  "ぴえんｗｗｗ　うっせぇわ",
  "紅蓮華 残響散歌 新時代",
];

describe("JapaneseReader (kuromoji + IPADIC)", () => {
  let tokenizer: JapaneseTokenizer;
  let reader: JapaneseReader;

  beforeAll(async () => {
    for (const name of DICTIONARY_FILE_NAMES) {
      const bytes = new Uint8Array(gunzipSync(await readFile(path.join(dictDir, name))));
      expect(bytes.length).toBe(DICTIONARY_FILES[name].unpacked);
      unpacked.set(name, bytes);
    }
    const yields = vi.fn(async () => {});
    tokenizer = await buildTokenizer(async (name) => trim(unpacked.get(name)!), yields);
    expect(yields.mock.calls.length).toBeGreaterThan(10);
    reader = new JapaneseReader(tokenizer);
  }, 60_000);

  it("tokenizes exactly as kuromoji's own loader", () => {
    const reference = referenceTokenizer();
    for (const line of CORPUS) {
      expect(tokenizer.tokenize(line)).toEqual(reference.tokenize(line));
    }
  });

  it("reads the target map as kuromoji does, padding or not", async () => {
    const map = unpacked.get("tid_map.dat.gz")!;
    const reference = new DynamicDictionaries();
    reference.token_info_dictionary.loadTargetMap(map);
    expect(await readTargetMap(trim(map), async () => {})).toEqual(reference.token_info_dictionary.target_map);
  });

  it("resolves kanji to hiragana", () => {
    expect(reader.hiragana("君の名は")).toBe("きみのなは");
    expect(reader.hiragana("新時代")).toBe("しんじだい");
  });

  it("writes romaji word by word, particles as pronounced", () => {
    expect(reader.romaji("君の名は")).toBe("kimi no na wa");
    expect(reader.romaji("祝福")).toBe("shukufuku");
    expect(reader.romaji("夢を見ていた")).toBe("yume o mite ita");
    expect(reader.romaji("欲しいのさ")).toBe("hoshii no sa");
    expect(reader.romaji("振り返りもせず")).toBe("furikaeri mo sezu");
  });

  it("doubles the consonant after a small っ across tokens", () => {
    expect(reader.romaji("ヒカリとなって")).toBe("hikari to natte");
    expect(reader.romaji("待っていた")).toBe("matte ita");
    expect(reader.romaji("行っちゃった")).toBe("itchatta");
  });

  it("keeps Latin text as written", () => {
    expect(reader.romaji("Hello 世界")).toBe("Hello sekai");
  });
});
