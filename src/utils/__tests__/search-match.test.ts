import { describe, expect, it } from "vitest";

import {
  filterByQuery,
  findMatchRange,
  foldForSearch,
} from "@/utils/search-match";

describe("foldForSearch", () => {
  it("lowercases", () => {
    expect(foldForSearch("Naruto SHIPPUDEN")).toBe("naruto shippuden");
  });

  it("strips diacritics", () => {
    expect(foldForSearch("Ação")).toBe("acao");
    expect(foldForSearch("café")).toBe("cafe");
    expect(foldForSearch("ÃÉÎÕÜ")).toBe("aeiou");
  });

  it("collapses runs of whitespace and trims the ends", () => {
    expect(foldForSearch("  A \t\n B  ")).toBe("a b");
    expect(foldForSearch("")).toBe("");
  });
});

describe("findMatchRange", () => {
  it("finds a plain substring and reports original indices", () => {
    expect(findMatchRange("naruto shippuden", "ship")).toEqual({
      start: 7,
      end: 11,
    });
  });

  it("ignores case", () => {
    expect(findMatchRange("Naruto", "NA")).toEqual({ start: 0, end: 2 });
  });

  it("ignores accents on both sides", () => {
    const haystack = "Ação";

    const range = findMatchRange(haystack, "CAO");

    expect(range).toEqual({ start: 1, end: 4 });
    expect(haystack.slice(range!.start, range!.end)).toBe("ção");

    expect(findMatchRange("café", "FE")).toEqual({ start: 2, end: 4 });
    expect(findMatchRange("cafe", "fé")).toEqual({ start: 2, end: 4 });
  });

  it("maps indices per original character when folding changes the length", () => {
    // A precomposed Hangul syllable decomposes into three characters under
    // NFD, so the folded string is longer than the original one: a naive
    // indexOf over the folded text would report 7 instead of 3.
    const haystack = "한글 cafe";

    expect(findMatchRange(haystack, "cafe")).toEqual({ start: 3, end: 7 });
  });

  it("keeps a decomposed haystack's accented characters inside the match", () => {
    const haystack = "Ac\u0327a\u0303o";

    const range = findMatchRange(haystack, "cao");

    expect(range).toEqual({ start: 1, end: 6 });
    expect(haystack.slice(range!.start, range!.end)).toBe("c\u0327a\u0303o");
  });

  it("finds a match behind an accented word", () => {
    expect(findMatchRange("Ação do Mal", "do")).toEqual({ start: 5, end: 7 });
  });

  it("normalizes whitespace on the needle", () => {
    expect(findMatchRange("café au lait", "  AU ")).toEqual({
      start: 5,
      end: 7,
    });
  });

  it("returns null when there is no match", () => {
    expect(findMatchRange("naruto", "bleach")).toBeNull();
  });

  it("returns null for an empty or whitespace-only needle", () => {
    expect(findMatchRange("naruto", "")).toBeNull();
    expect(findMatchRange("naruto", "   ")).toBeNull();
  });
});

describe("filterByQuery", () => {
  const items = [
    { title: "Naruto Shippuden" },
    { title: "Bleach" },
    { title: "Boruto: Naruto Next Generations" },
  ];
  const titles = (list: readonly { title: string }[]) =>
    list.map((item) => item.title);

  it("keeps every item for an empty needle", () => {
    expect(filterByQuery(items, "", (item) => item.title)).toEqual(items);
    expect(filterByQuery(items, "   ", (item) => item.title)).toEqual(items);
  });

  it("filters ignoring case and accents", () => {
    const accented = [
      { title: "Ação" },
      { title: "Bleach" },
      { title: "Açúcar" },
    ];

    expect(
      titles(filterByQuery(accented, "ACAO", (item) => item.title)),
    ).toEqual(["Ação"]);
  });

  it("orders a prefix match ahead of a non-prefix one", () => {
    const result = filterByQuery(items, "naruto", (item) => item.title);

    expect(titles(result)).toEqual([
      "Naruto Shippuden",
      "Boruto: Naruto Next Generations",
    ]);
  });

  it("flips the order when the prefix match is the older entry", () => {
    const result = filterByQuery(
      [items[2], items[0]],
      "naruto",
      (item) => item.title,
    );

    expect(titles(result)).toEqual([
      "Naruto Shippuden",
      "Boruto: Naruto Next Generations",
    ]);
  });

  it("keeps the original order inside each group", () => {
    const result = filterByQuery(
      [items[0], items[2]],
      "a",
      (item) => item.title,
    );

    expect(titles(result)).toEqual([items[0].title, items[2].title]);
  });

  it("ranks exact, then prefix, then word start, then anywhere", () => {
    const ranked = filterByQuery(
      [
        { title: "Fullmetal" },
        { title: "Metal Gear" },
        { title: "Heavy Metal" },
        { title: "metal" },
      ],
      "METAL",
      (item) => item.title,
    );

    expect(titles(ranked)).toEqual([
      "metal",
      "Metal Gear",
      "Heavy Metal",
      "Fullmetal",
    ]);
  });

  it("drops everything when nothing contains the needle", () => {
    expect(filterByQuery(items, "onepiece", (item) => item.title)).toEqual([]);
  });
});
