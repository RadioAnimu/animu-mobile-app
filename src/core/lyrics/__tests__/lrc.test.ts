import { describe, expect, it } from "vitest";
import {
  BREAK_MIN_MS,
  INTRO_MIN_MS,
  UNMARKED_BREAK_MS,
  buildTimeline,
  entryIndexAt,
  parseLrc,
  plainLines,
  syncedToPlain,
} from "@/core/lyrics/lrc";
import type { LyricLine } from "@/core/lyrics/types";

const lines = (lrc: string) =>
  buildTimeline(parseLrc(lrc)).filter((entry): entry is LyricLine => entry.kind === "line");

describe("parseLrc", () => {
  it("reads every fraction notation as milliseconds", () => {
    const rows = parseLrc("[00:01.5]a\n[00:02.34]b\n[00:03.345]c\n[00:04]d\n[00:05:20]e");
    expect(rows.map((row) => row.startMs)).toEqual([1_500, 2_340, 3_345, 4_000, 5_200]);
  });

  it("expands rows with several stamps (a repeated chorus) and sorts them", () => {
    const rows = parseLrc("[00:30.00][00:10.00]Chorus\n[00:20.00]Verse");
    expect(rows.map((row) => [row.startMs, row.text])).toEqual([
      [10_000, "Chorus"],
      [20_000, "Verse"],
      [30_000, "Chorus"],
    ]);
  });

  it("drops metadata tags and keeps empty stamps as break markers", () => {
    const rows = parseLrc("[ar:LiSA]\n[ti:Gurenge]\n[length: 03:55]\n[00:01.00]Line\n[00:04.00]");
    expect(rows.map((row) => row.text)).toEqual(["Line", ""]);
  });

  it("applies [offset:] (positive shows lyrics sooner)", () => {
    expect(parseLrc("[offset:+500]\n[00:02.00]a")[0].startMs).toBe(1_500);
    expect(parseLrc("[offset:-500]\n[00:02.00]a")[0].startMs).toBe(2_500);
  });

  it("drops duplicated rows and invalid seconds", () => {
    const rows = parseLrc("[00:01.00]a\n[00:01.00]a\n[00:75.00]bad");
    expect(rows).toHaveLength(1);
  });

  it("reads enhanced word tags, closing the last word with a trailing tag", () => {
    const [row] = parseLrc("[00:12.00]<00:12.00>Hello <00:12.50>world<00:13.20>");
    expect(row.text).toBe("Hello world");
    expect(row.words?.map(({ text, startMs, spaceAfter }) => [text, startMs, spaceAfter])).toEqual([
      ["Hello", 12_000, true],
      ["world", 12_500, false],
    ]);
    expect(row.endTagMs).toBe(13_200);
  });

  it("keeps Japanese syllables unspaced", () => {
    const [row] = parseLrc("[00:01.00]<00:01.00>君<00:01.40>の<00:01.70>名<00:02.00>は<00:02.60>");
    expect(row.text).toBe("君の名は");
    expect(row.words?.every((word) => !word.spaceAfter)).toBe(true);
  });

  it("treats a single tagged word as a whole line", () => {
    const [row] = parseLrc("[00:01.00]<00:01.00>Oh<00:02.00>");
    expect(row.words).toBeNull();
    expect(row.text).toBe("Oh");
  });
});

describe("buildTimeline", () => {
  it("adds an intro interlude when the first line comes late", () => {
    const entries = buildTimeline(parseLrc(`[00:${(INTRO_MIN_MS / 1000 + 6).toFixed(2)}]First`));
    expect(entries[0]).toEqual({ kind: "interlude", startMs: 0, endMs: INTRO_MIN_MS + 6_000 });
    expect(buildTimeline(parseLrc("[00:01.00]First"))[0].kind).toBe("line");
  });

  it("ends each line at the next one when the gap is short", () => {
    expect(lines("[00:01.00]a\n[00:03.00]b").map((line) => [line.startMs, line.endMs])[0]).toEqual([1_000, 3_000]);
  });

  it("turns a marked break into an interlude", () => {
    const entries = buildTimeline(parseLrc("[00:01.00]a\n[00:04.00]\n[00:20.00]b"));
    expect(entries.map((entry) => [entry.kind, entry.startMs, entry.endMs])).toEqual([
      ["line", 1_000, 4_000],
      ["interlude", 4_000, 20_000],
      ["line", 20_000, 26_000],
    ]);
  });

  it("ignores a marker before a short gap: the line stays lit", () => {
    const gap = BREAK_MIN_MS - 1_000;
    const entries = buildTimeline(parseLrc(`[00:01.00]a\n[00:02.00]\n[00:0${(2_000 + gap) / 1000}]b`));
    expect(entries.map((entry) => entry.kind)).toEqual(["line", "line"]);
    expect(entries[0].endMs).toBe(2_000 + gap);
  });

  it("ends a line before a long unmarked gap and fills the rest with dots", () => {
    const next = (1_000 + UNMARKED_BREAK_MS + 10_000) / 1000;
    const entries = buildTimeline(parseLrc(`[00:01.00]Short line\n[00:${next.toFixed(2)}]b`));
    expect(entries.map((entry) => entry.kind)).toEqual(["line", "interlude", "line"]);
    expect(entries[0].endMs).toBeLessThan(entries[2].startMs);
    expect(entries[1].endMs).toBe(entries[2].startMs);
  });

  it("bounds word-timed lines by their end tag, every word inside the line", () => {
    const [line] = lines("[00:01.00]<00:01.00>a <00:01.50>b<00:02.00>\n[00:03.00]c");
    expect(line.endMs).toBe(3_000);
    expect(line.words?.map((word) => [word.startMs, word.endMs])).toEqual([
      [1_000, 1_500],
      [1_500, 2_000],
    ]);
  });

  it("is empty for a document without timed text", () => {
    expect(buildTimeline(parseLrc("just text\n[ar:x]"))).toEqual([]);
  });
});

describe("entryIndexAt", () => {
  const spans = [
    { startMs: 0, endMs: 5_000 },
    { startMs: 5_000, endMs: 8_000 },
    { startMs: 8_000, endMs: 12_000 },
  ];

  it("finds the entry playing, -1 before the first and length after the last", () => {
    expect(entryIndexAt(spans, -1)).toBe(-1);
    expect(entryIndexAt(spans, 0)).toBe(0);
    expect(entryIndexAt(spans, 7_999)).toBe(1);
    expect(entryIndexAt(spans, 11_999)).toBe(2);
    expect(entryIndexAt(spans, 12_000)).toBe(3);
    expect(entryIndexAt([], 1)).toBe(-1);
  });
});

describe("plain lyrics", () => {
  it("trims lines and collapses blank runs into one stanza gap", () => {
    expect(plainLines("\r\n a \r\n\r\n\r\n b\n\n")).toEqual(["a", "", "b"]);
  });

  it("flattens synced lyrics to their text", () => {
    expect(syncedToPlain("[00:01.00]a\n[00:02.00]\n[00:03.00]<00:03.00>b <00:03.50>c")).toEqual(["a", "b c"]);
  });
});
