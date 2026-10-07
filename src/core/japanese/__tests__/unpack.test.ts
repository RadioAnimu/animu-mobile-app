import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { DICTIONARY_FILES, type DictionaryFileName } from "@/core/japanese/dictionary";
import { gunzipTrimmed, padTo } from "@/core/japanese/unpack";

const dictDir = path.join(path.dirname(createRequire(import.meta.url).resolve("kuromoji/package.json")), "dict");

describe("gunzipTrimmed", () => {
  it.each<DictionaryFileName>(["tid.dat.gz", "unk.dat.gz", "unk_compat.dat.gz", "cc.dat.gz"])(
    "unpacks %s to its published sizes, yielding as it goes",
    async (name) => {
      const file = DICTIONARY_FILES[name];
      const yieldNow = vi.fn(async () => {});
      const progress: number[] = [];
      const stored = await gunzipTrimmed(
        new Uint8Array(await readFile(path.join(dictDir, name))),
        file.unpacked,
        (done) => progress.push(done),
        yieldNow,
      );
      expect(stored.length).toBe(file.stored);
      expect(progress.at(-1)).toBe(file.bytes);
      expect(yieldNow).toHaveBeenCalled();
      expect(padTo(stored, file.unpacked).length).toBe(file.unpacked);
    },
  );

  it("rejects content of another size", async () => {
    const gz = new Uint8Array(gzipSync(new Uint8Array(100).fill(7)));
    await expect(gunzipTrimmed(gz, 50, () => {}, async () => {})).rejects.toThrow();
    await expect(gunzipTrimmed(gz, 200, () => {}, async () => {})).rejects.toThrow("shorter");
  });
});
