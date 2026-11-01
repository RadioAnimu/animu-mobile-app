// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { JapaneseReader } from "@/core/japanese";
import type { Lyrics } from "@/core/lyrics/types";

vi.mock("@/contexts/user/UserSettingsProvider", () => ({ useUserSettings: vi.fn() }));
const dictionary = vi.hoisted(() => ({
  loadReader: vi.fn(async () => {}),
  releaseReader: vi.fn(),
  currentReader: null,
}));
vi.mock("@/core/japanese", () => ({ japaneseDictionary: dictionary }));
vi.mock("@/hooks/useJapaneseDictionary", () => ({ useJapaneseDictionary: vi.fn() }));
vi.mock("@/hooks/useSaveSettings", () => ({ useSaveSettings: () => vi.fn().mockResolvedValue(true) }));

const { effectiveMode, labelsInSteps, labelsOf, modesFor, usePronunciation } = await import(
  "@/screens/Lyrics/usePronunciation"
);
const { useUserSettings } = await import("@/contexts/user/UserSettingsProvider");
const { useJapaneseDictionary } = await import("@/hooks/useJapaneseDictionary");

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
/** A dictionary reading each line as one word. */
const reader = {
  words: (text: string) => [{ text, romaji: `r(${text})`, hiragana: `h(${text})`, spaceAfter: false }],
} as unknown as JapaneseReader;

describe("pronunciation modes", () => {
  it("offers romaji from a sibling upload without the dictionary, everything with it", () => {
    expect(modesFor(synced(null), false)).toEqual(["off"]);
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
    const text = (labels: ReturnType<typeof labelsOf>) =>
      labels.map((label) => (label?.kind === "line" ? label.text : label?.segments.map((segment) => segment.label).join("|") ?? null));
    expect(text(labelsOf(synced(["", "kimi no na wa", ""]), "romaji", reader))).toEqual([null, "kimi|no|na|wa", "r(夢を見ていた)"]);
    expect(text(labelsOf(synced(["", "kimi no na wa", ""]), "hiragana", reader))).toEqual([null, "h(君の名は)", "h(夢を見ていた)"]);
    expect(labelsOf(synced(["", "kimi no na wa", ""]), "off", reader)).toEqual([]);
    expect(text(labelsOf(synced(["", "kimi no na wa", ""]), "romaji", null))).toEqual([null, "kimi|no|na|wa", null]);
  });
});

describe("labelsInSteps", () => {
  it("reads the same labels as at once, yielding between steps", async () => {
    const song = synced(["", "kimi no na wa", ""]);
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 5));
    const yields = vi.fn(async () => {});
    expect(await labelsInSteps(song, "hiragana", reader, yields)).toEqual(labelsOf(song, "hiragana", reader));
    expect(yields).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("usePronunciation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the dictionary's reader only when the shown mode needs it", () => {
    vi.useFakeTimers();
    vi.mocked(useJapaneseDictionary).mockReturnValue({ install: "installed", reader: "idle" } as never);
    const pronunciation = (mode: string) =>
      vi.mocked(useUserSettings).mockReturnValue({ settings: { lyricsPronunciation: mode } } as never);

    pronunciation("off");
    const { rerender } = renderHook(({ lyrics }) => usePronunciation(lyrics), {
      initialProps: { lyrics: synced(null) },
    });
    vi.runAllTimers();
    // Romaji the song carries itself needs no reader either.
    pronunciation("romaji");
    rerender({ lyrics: synced(["kimi no na wa", "yume wo miteita"]) });
    vi.runAllTimers();
    expect(dictionary.loadReader).not.toHaveBeenCalled();

    // Romaji with no human version comes from the dictionary.
    pronunciation("romaji");
    rerender({ lyrics: synced(null) });
    vi.runAllTimers();
    expect(dictionary.loadReader).toHaveBeenCalledTimes(1);

    pronunciation("hiragana");
    rerender({ lyrics: synced(null) });
    vi.runAllTimers();
    // Still needed: the effect does not run again, nothing reloads.
    expect(dictionary.loadReader).toHaveBeenCalledTimes(1);
  });
});
