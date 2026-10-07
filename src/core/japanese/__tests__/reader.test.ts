import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DICTIONARY_FILE_NAMES } from "@/core/japanese/dictionary";
import { JapaneseReader } from "@/core/japanese/reader";
import { buildTokenizer } from "@/core/japanese/tokenizer";

// The real IPADIC from the installed kuromoji package: proves the RN loader
// (no Node `path`/`fs` inside kuromoji) builds a working tokenizer.
const dictDir = path.join(path.dirname(createRequire(import.meta.url).resolve("kuromoji/package.json")), "dict");

describe("JapaneseReader (kuromoji + IPADIC)", () => {
  let reader: JapaneseReader;

  beforeAll(async () => {
    const started = Date.now();
    const tokenizer = await buildTokenizer(async (name) => new Uint8Array(await readFile(path.join(dictDir, name))));
    console.log(`tokenizer built in ${Date.now() - started} ms (${DICTIONARY_FILE_NAMES.length} files)`);
    reader = new JapaneseReader(tokenizer);
  }, 60_000);

  it("resolves kanji to hiragana", () => {
    expect(reader.hiragana("君の名は")).toBe("きみのなは");
    expect(reader.hiragana("新時代")).toBe("しんじだい");
  });

  it("writes romaji word by word, particles as pronounced", () => {
    expect(reader.romaji("君の名は")).toBe("kimi no na wa");
    expect(reader.romaji("祝福")).toBe("shukufuku");
    expect(reader.romaji("夢を見ていた")).toBe("yume o miteita");
  });

  it("keeps Latin text as written", () => {
    expect(reader.romaji("Hello 世界")).toBe("Hello sekai");
  });
});
