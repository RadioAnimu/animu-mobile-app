import { describe, expect, it } from "vitest";
import {
  findLineIndex,
  findWordIndex,
  parseLrc,
  prepareKaraoke,
} from "../lrc-parser";
import type { LyricLine } from "../types";

const bodyOf = (lines: LyricLine[]) => lines.map((line) => line.text);

describe("parseLrc", () => {
  it("parses two-digit fractions as hundredths", () => {
    const lines = parseLrc("[00:12.34]Hello");
    expect(lines).toHaveLength(1);
    expect(lines[0].timeMs).toBe(12_340);
    expect(lines[0].text).toBe("Hello");
  });

  it("parses three-digit fractions as milliseconds", () => {
    const lines = parseLrc("[01:02.345]World");
    expect(lines[0].timeMs).toBe(62_345);
  });

  it("expands multi-timestamp rows into one line per stamp", () => {
    const lines = parseLrc("[00:01.00]a\n[00:02.00][00:10.00]b");
    expect(bodyOf(lines)).toEqual(["a", "b", "b"]);
    expect(lines.map((line) => line.timeMs)).toEqual([1_000, 2_000, 10_000]);
  });

  it("drops metadata rows, empty rows and unparsable rows", () => {
    const lines = parseLrc(
      "[ti:Song]\n[ar:Artist]\n[offset:+500]\n\n[00:01.00]line\n[gibberish]\n",
    );
    expect(bodyOf(lines)).toEqual(["line"]);
  });

  it("applies the offset tag (positive offset shifts lyrics earlier)", () => {
    const lines = parseLrc("[offset:+500]\n[00:10.00]early");
    expect(lines[0].timeMs).toBe(9_500);
  });

  it("delays lines with a negative offset", () => {
    const lines = parseLrc("[offset:-5000]\n[00:02.00]late");
    expect(lines[0].timeMs).toBe(7_000);
  });

  it("keeps the run of adjacent time tags only", () => {
    const lines = parseLrc("[00:05.00]text [00:99.00]not-a-stamp");
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("text [00:99.00]not-a-stamp");
  });

  it("parses enhanced word tags into measured words", () => {
    const lines = parseLrc(
      "[00:10.00]<00:10.00>come <00:11.00>on <00:12.00>let's <00:13.00>go",
    );
    expect(lines[0].wordTimed).toBe(true);
    expect(lines[0].words).toEqual([
      { text: "come", startMs: 10_000 },
      { text: "on", startMs: 11_000 },
      { text: "let's", startMs: 12_000 },
      { text: "go", startMs: 13_000 },
    ]);
  });

  it("assigns text before the first word tag the line start", () => {
    const lines = parseLrc("[00:10.00]Go <00:11.00>now");
    expect(lines[0].words[0]).toEqual({ text: "Go", startMs: 10_000 });
    expect(lines[0].words[1]).toEqual({ text: "now", startMs: 11_000 });
  });

  it("sorts unsorted input chronologically and dedupes", () => {
    const lines = parseLrc(
      "[00:20.00]b\n[00:10.00]a\n[00:10.00]a\n[00:20.00]b",
    );
    expect(bodyOf(lines)).toEqual(["a", "b"]);
  });
});

describe("prepareKaraoke", () => {
  it("keeps measured word timings untouched", () => {
    const lines = parseLrc("[00:10.00]<00:10.50>one <00:11.00>two");
    const prepared = prepareKaraoke(lines);
    expect(prepared[0].words.map((word) => word.startMs)).toEqual([
      10_500, 11_000,
    ]);
    expect(prepared[0].wordTimed).toBe(true);
  });

  it("spreads estimated timings across words, monotonic and inside the window", () => {
    const lines = parseLrc("[00:10.00]two three words here\n[00:14.00]next");
    const prepared = prepareKaraoke(lines);
    const words = prepared[0].words;

    expect(words).toHaveLength(4);
    expect(words[0].startMs).toBeGreaterThanOrEqual(10_000);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i].startMs).toBeGreaterThan(words[i - 1].startMs);
    }
    expect(words[words.length - 1].startMs).toBeLessThan(14_000);
    expect(prepared[0].wordTimed).toBe(false);
  });

  it("falls back to a length-based window on the final line", () => {
    const lines = parseLrc("[00:10.00]last line");
    const prepared = prepareKaraoke(lines);
    expect(prepared[0].words).toHaveLength(2);
    expect(prepared[0].words[1].startMs).toBeGreaterThan(10_000);
  });
});

describe("find indexes", () => {
  const lines = parseLrc(
    "[00:10.00]one\n[00:20.00]two\n[00:30.00]<00:30.00>a <00:31.00>b",
  );

  it("finds the line being sung, or -1 during the intro", () => {
    expect(findLineIndex(lines, 5_000)).toBe(-1);
    expect(findLineIndex(lines, 10_000)).toBe(0);
    expect(findLineIndex(lines, 25_000)).toBe(1);
    expect(findLineIndex(lines, 99_000)).toBe(2);
  });

  it("finds the word being sung, or -1 before the first word", () => {
    const words = lines[2].words;
    expect(findWordIndex(words, 29_999)).toBe(-1);
    expect(findWordIndex(words, 30_000)).toBe(0);
    expect(findWordIndex(words, 31_200)).toBe(1);
  });
});
