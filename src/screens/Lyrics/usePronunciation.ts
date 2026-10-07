import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { japaneseDictionary, type JapaneseDictionarySnapshot, type JapaneseReader } from "@/core/japanese";
import type { Lyrics } from "@/core/lyrics/types";
import { pronunciationOf, type PronunciationMode } from "@/core/lyrics/pronunciation";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";
import type { PronunciationButton } from "@/screens/Lyrics/LyricsHeader";
import { haptics } from "@/utils/haptics";

const isJapanese = (lyrics: Lyrics | null): boolean =>
  lyrics != null && lyrics.kind !== "instrumental" && lyrics.language === "ja";

/** Romaji from a sibling upload, when LRCLIB has one for these lines. */
const pairedRomaji = (lyrics: Lyrics | null): string[] | null =>
  lyrics?.kind === "synced" ? lyrics.romaji : null;

/**
 * The modes this song can show: romaji from its sibling upload, or anything
 * the dictionary reads. Empty: only the dictionary would help.
 */
export function modesFor(lyrics: Lyrics | null, installed: boolean): PronunciationMode[] {
  if (!isJapanese(lyrics)) return [];
  if (installed) return ["off", "romaji", "hiragana"];
  return pairedRomaji(lyrics) ? ["off", "romaji"] : [];
}

/** The stored mode where the song allows it, else the closest it can show. */
export function effectiveMode(mode: PronunciationMode, modes: readonly PronunciationMode[]): PronunciationMode {
  if (modes.includes(mode)) return mode;
  return mode !== "off" && modes.includes("romaji") ? "romaji" : "off";
}

/** Pronunciation labels for every line of the song (`""` for none). */
export function labelsOf(lyrics: Lyrics | null, mode: PronunciationMode, reader: JapaneseReader | null): string[] {
  if (!lyrics || !isJapanese(lyrics) || mode === "off") return [];
  if (lyrics.kind === "plain") return lyrics.lines.map((text) => pronunciationOf(text, mode, reader));
  if (lyrics.kind !== "synced") return [];
  // Human romaji first (the sibling upload), the dictionary for the rest.
  const paired = mode === "romaji" ? lyrics.romaji : null;
  return lyrics.entries.map((entry, index) => {
    if (entry.kind !== "line") return "";
    return paired?.[index] || pronunciationOf(entry.text, mode, reader);
  });
}

export interface Pronunciation {
  labels: string[];
  /** The header toggle, for Japanese lyrics only. */
  button: PronunciationButton | null;
  /** The dictionary offer is showing. */
  promptOpen: boolean;
  /** The reader is being built (labels follow shortly). */
  preparing: boolean;
  /** The reader could not be built: no dictionary labels this session. */
  failed: boolean;
  dictionary: JapaneseDictionarySnapshot;
}

/**
 * Romaji / hiragana under Japanese lines: the user's mode, the sources the
 * song has (a romaji sibling upload, the opt-in dictionary — offered in place
 * when neither exists) and the dictionary's reader, built once the screen has
 * settled and released when it closes.
 */
export function usePronunciation(lyrics: Lyrics | null): Pronunciation {
  const { settings, updateSettings } = useUserSettings();
  const dictionary = useJapaneseDictionary();
  const [promptWanted, setPromptWanted] = useState(false);
  const installed = dictionary.install === "installed";
  const modes = modesFor(lyrics, installed);
  const mode = effectiveMode(settings.lyricsPronunciation, modes);
  const japanese = isJapanese(lyrics);

  useEffect(() => {
    if (!installed) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      japaneseDictionary.loadReader().catch(() => {});
    });
    return () => task.cancel();
  }, [installed]);

  // The reader holds ~100 MB: only while the lyrics are open.
  useEffect(() => () => japaneseDictionary.unloadReader(), []);

  const reader = dictionary.reader === "ready" ? japaneseDictionary.currentReader : null;
  const labels = useMemo(() => labelsOf(lyrics, mode, reader), [lyrics, mode, reader]);
  const promptOpen = japanese && modes.length === 0 && promptWanted;

  const button: PronunciationButton | null = japanese
    ? {
        mode,
        canLabel: modes.length > 0,
        promptOpen,
        onPress: () => {
          haptics.select();
          if (modes.length === 0) {
            setPromptWanted((open) => !open);
            return;
          }
          const next = modes[(modes.indexOf(mode) + 1) % modes.length];
          updateSettings({ lyricsPronunciation: next }).catch(() => {});
        },
      }
    : null;

  // Only the dictionary's labels wait for the reader.
  const needsReader = installed && mode !== "off" && (mode === "hiragana" || !pairedRomaji(lyrics));
  return {
    labels,
    button,
    promptOpen,
    preparing: needsReader && dictionary.reader === "loading",
    failed: needsReader && dictionary.reader === "error",
    dictionary,
  };
}
