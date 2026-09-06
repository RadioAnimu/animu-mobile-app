import { describe, expect, it } from "vitest";
import {
  artistVariants,
  containment,
  looksLikeJunk,
  normalizeText,
  similarity,
  tokenOverlap,
} from "../text";

describe("normalizeText", () => {
  it("folds full-width characters, case and whitespace", () => {
    expect(normalizeText("Ｂｌｕｅｍｉｎｇ　ＴＶ")).toBe(
      normalizeText("blueming tv"),
    );
  });

  it("transliterates kana so scripts compare equal", () => {
    expect(normalizeText("ヒバナ")).toBe("hibana");
    expect(normalizeText("Hibana")).toBe("hibana");
  });

  it("strips bracketed qualifiers from both sides", () => {
    expect(normalizeText("アイドル (TV Size)")).toBe(
      normalizeText("アイドル"),
    );
  });

  it("strips version keywords outside brackets too", () => {
    expect(normalizeText("Song - TV Size")).toBe(normalizeText("song"));
  });

  it("keeps kanji (no dictionary available), enabling kanji-vs-kanji equality", () => {
    expect(normalizeText("紅蓮華")).toBe("紅蓮華");
  });

  it("falls back to the unstripped form when the whole title was bracketed", () => {
    expect(normalizeText("「アイドル」")).toBe("aidoru");
  });
});

describe("similarity", () => {
  it("is 1 for identical strings and 0 when one side is empty", () => {
    expect(similarity("aidoru", "aidoru")).toBe(1);
    expect(similarity("aidoru", "")).toBe(0);
  });

  it("degrades smoothly with edit distance", () => {
    const near = similarity("hibana", "hibane");
    const far = similarity("hibana", "renai");
    expect(near).toBeGreaterThan(far);
    expect(near).toBeGreaterThan(0.6);
  });
});

describe("tokenOverlap / containment", () => {
  it("measures shared tokens regardless of order", () => {
    expect(tokenOverlap("one two", "two one")).toBe(1);
    expect(tokenOverlap("one two", "three four")).toBe(0);
  });

  it("containment is the fraction of needle tokens found", () => {
    expect(containment("one two three", "two one four")).toBeCloseTo(2 / 3);
  });
});

describe("artistVariants", () => {
  it("splits featured and collaboration roles", () => {
    const variants = artistVariants(" Ado feat. Hana ");
    expect(variants).toContain("ado");
    expect(variants).toContain("hana");
  });

  it("keeps the full joined variant as well", () => {
    const variants = artistVariants("YOASOBI");
    expect(variants).toContain("yoasobi");
  });
});

describe("looksLikeJunk", () => {
  it("flags upload junk markers", () => {
    expect(looksLikeJunk("アイドル (Official MV)")).toBe(true);
    expect(looksLikeJunk("nightcore version")).toBe(true);
    expect(looksLikeJunk("アイドル")).toBe(false);
  });
});
