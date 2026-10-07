import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { japaneseDictionary, type JapaneseDictionarySnapshot, type JapaneseReader } from "@/core/japanese";
import type { Lyrics } from "@/core/lyrics/types";
import { pronunciationOf, type PronunciationMode } from "@/core/lyrics/pronunciation";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";

const isJapanese = (lyrics: Lyrics | null): boolean =>
  lyrics != null && lyrics.kind !== "instrumental" && lyrics.language === "ja";

/** Romaji from a sibling upload, when LRCLIB has one for these lines. */
const pairedRomaji = (lyrics: Lyrics | null): string[] | null =>
  lyrics?.kind === "synced" ? lyrics.romaji : null;

/**
 * The modes this song can show: romaji from its sibling upload, anything the
 * dictionary reads, and off. Empty: not Japanese, nothing to offer.
 */
export function modesFor(lyrics: Lyrics | null, installed: boolean): PronunciationMode[] {
  if (!isJapanese(lyrics)) return [];
  if (installed) return ["off", "romaji", "hiragana"];
  return pairedRomaji(lyrics) ? ["off", "romaji"] : ["off"];
}

/** The stored mode where the song allows it, else the closest it can show. */
export function effectiveMode(mode: PronunciationMode, modes: readonly PronunciationMode[]): PronunciationMode {
  if (modes.includes(mode)) return mode;
  return mode !== "off" && modes.includes("romaji") ? "romaji" : "off";
}

/** Each line's text, and its human romaji when the mode can use it (`null`: not a line). */
function linesOf(lyrics: Lyrics | null, mode: PronunciationMode): { text: string; paired: string }[] | null {
  if (!lyrics || !isJapanese(lyrics) || mode === "off") return null;
  if (lyrics.kind === "plain") return lyrics.lines.map((text) => ({ text, paired: "" }));
  if (lyrics.kind !== "synced") return null;
  const paired = mode === "romaji" ? lyrics.romaji : null;
  return lyrics.entries.map((entry, index) => ({
    text: entry.kind === "line" ? entry.text : "",
    paired: paired?.[index] ?? "",
  }));
}

/** Pronunciation labels for every line of the song (`""` for none), at once. */
export function labelsOf(lyrics: Lyrics | null, mode: PronunciationMode, reader: JapaneseReader | null): string[] {
  // Human romaji first (the sibling upload), the dictionary for the rest.
  return (linesOf(lyrics, mode) ?? []).map(({ text, paired }) => paired || pronunciationOf(text, mode, reader));
}

/** JS time spent reading lines before yielding (ms). */
const LABEL_BUDGET_MS = 8;

/**
 * {@link labelsOf} with the dictionary, in ~8 ms steps: tokenizing a whole
 * song takes a few hundred ms on a phone, too long for one render.
 */
export async function labelsInSteps(
  lyrics: Lyrics | null,
  mode: PronunciationMode,
  reader: JapaneseReader,
  yieldNow: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<string[]> {
  const lines = linesOf(lyrics, mode) ?? [];
  const labels: string[] = [];
  let started = Date.now();
  for (const { text, paired } of lines) {
    if (Date.now() - started >= LABEL_BUDGET_MS) {
      await yieldNow();
      started = Date.now();
    }
    labels.push(paired || pronunciationOf(text, mode, reader));
  }
  return labels;
}

/** Labels read with the dictionary, and what they were read for. */
interface ReadLabels {
  lyrics: Lyrics | null;
  mode: PronunciationMode;
  reader: JapaneseReader;
  labels: string[];
}

export interface Pronunciation {
  labels: string[];
  /** The mode shown (the stored one, where the song allows it). */
  mode: PronunciationMode;
  /** Modes the song can show; empty for non-Japanese lyrics (no menu). */
  modes: PronunciationMode[];
  select: (mode: PronunciationMode) => void;
  /** The reader is being built (labels follow shortly). */
  preparing: boolean;
  /** The reader could not be built: no dictionary labels this session. */
  failed: boolean;
  dictionary: JapaneseDictionarySnapshot;
}

/**
 * Romaji / hiragana under Japanese lines: the user's mode, the sources the
 * song has (a romaji sibling upload, the opt-in dictionary) and the
 * dictionary's reader, built once the screen has settled and released when
 * it closes.
 */
export function usePronunciation(lyrics: Lyrics | null): Pronunciation {
  const { settings, updateSettings } = useUserSettings();
  const dictionary = useJapaneseDictionary();
  const installed = dictionary.install === "installed";
  const modes = modesFor(lyrics, installed);
  const mode = effectiveMode(settings.lyricsPronunciation, modes);

  useEffect(() => {
    if (!installed) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      japaneseDictionary.loadReader().catch(() => {});
    });
    return () => task.cancel();
  }, [installed]);

  // The reader holds tens of MB: only while the lyrics are open.
  useEffect(() => () => japaneseDictionary.unloadReader(), []);

  const reader = dictionary.reader === "ready" ? japaneseDictionary.currentReader : null;
  // Human romaji shows at once; the dictionary's labels land when read.
  const instant = useMemo(() => labelsOf(lyrics, mode, null), [lyrics, mode]);
  const [read, setRead] = useState<ReadLabels | null>(null);
  useEffect(() => {
    if (!reader || mode === "off") return undefined;
    let cancelled = false;
    labelsInSteps(lyrics, mode, reader)
      .then((labels) => {
        if (!cancelled) setRead({ lyrics, mode, reader, labels });
      })
      .catch((error) => console.warn("[Lyrics] pronunciation:", error));
    return () => {
      cancelled = true;
    };
  }, [lyrics, mode, reader]);
  const current = read?.lyrics === lyrics && read.mode === mode && read.reader === reader;
  const labels = current ? read.labels : instant;

  // Only the dictionary's labels wait for the reader.
  const needsReader = installed && mode !== "off" && (mode === "hiragana" || !pairedRomaji(lyrics));
  return {
    labels,
    mode,
    modes,
    select: (next) => {
      updateSettings({ lyricsPronunciation: next }).catch(() => {});
    },
    preparing: needsReader && dictionary.reader === "loading",
    failed: needsReader && dictionary.reader === "error",
    dictionary,
  };
}
