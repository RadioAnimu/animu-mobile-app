import { describe, expect, it, vi } from "vitest";
import type { JapaneseReader } from "@/core/japanese";
import type { Lyrics } from "@/core/lyrics/types";

vi.mock("react-native", () => ({ InteractionManager: { runAfterInteractions: vi.fn() } }));
vi.mock("@/contexts/user/UserSettingsProvider", () => ({ useUserSettings: vi.fn() }));
vi.mock("@/core/japanese", () => ({ japaneseDictionary: {} }));
vi.mock("@/hooks/useJapaneseDictionary", () => ({ useJapaneseDictionary: vi.fn() }));
vi.mock("@/utils/haptics", () => ({ haptics: { select: vi.fn() } }));

const { effectiveMode, labelsOf, modesFor } = await import("@/screens/Lyrics/usePronunciation");

const source = { provider: "lrclib" as const, id: 1, title: "", artist: "", album: "", durationMs: null };
const synced = (romaji: string[] | null): Lyrics => ({
  kind: "synced",
  entries: [
    { kind: "interlude", startMs: 0, endMs: 5_000 },
    { kind: "line", startMs: 5_000, endMs: 8_000, text: "君の名は", words: null },
    { kind: "line", startMs: 8_000, endMs: 9_000, text: "夢を見ていた", words: null },
  ],
  wordTimed: false,
  romaji,
  language: "ja",
  source,
});
const reader = { romaji: (text: string) => `r(${text})`, hiragana: (text: string) => `h(${text})` } as unknown as JapaneseReader;

describe("pronunciation modes", () => {
  it("offers romaji from a sibling upload without the dictionary, everything with it", () => {
    expect(modesFor(synced(null), false)).toEqual([]);
    expect(modesFor(synced(["", "kimi no na wa", ""]), false)).toEqual(["off", "romaji"]);
    expect(modesFor(synced(null), true)).toEqual(["off", "romaji", "hiragana"]);
    expect(modesFor({ kind: "instrumental", source }, true)).toEqual([]);
  });

  it("falls back to what the song can show", () => {
    expect(effectiveMode("hiragana", ["off", "romaji"])).toBe("romaji");
    expect(effectiveMode("off", ["off", "romaji"])).toBe("off");
    expect(effectiveMode("romaji", [])).toBe("off");
  });

  it("labels with the human romaji first, the dictionary for the rest", () => {
    expect(labelsOf(synced(["", "kimi no na wa", ""]), "romaji", reader)).toEqual(["", "kimi no na wa", "r(夢を見ていた)"]);
    expect(labelsOf(synced(["", "kimi no na wa", ""]), "hiragana", reader)).toEqual(["", "h(君の名は)", "h(夢を見ていた)"]);
    expect(labelsOf(synced(["", "kimi no na wa", ""]), "off", reader)).toEqual([]);
    expect(labelsOf(synced(["", "kimi no na wa", ""]), "romaji", null)).toEqual(["", "kimi no na wa", ""]);
  });
});
