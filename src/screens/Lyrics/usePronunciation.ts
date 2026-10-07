import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { japaneseDictionary, type JapaneseDictionarySnapshot, type JapaneseReader } from "@/core/japanese";
import type { Lyrics } from "@/core/lyrics/types";
import { pronunciationOf, type PronunciationMode } from "@/core/lyrics/pronunciation";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";
import type { PronunciationButton } from "@/screens/Lyrics/LyricsHeader";
import { haptics } from "@/utils/haptics";

const NEXT_MODE: Record<PronunciationMode, PronunciationMode> = {
  off: "romaji",
  romaji: "hiragana",
  hiragana: "off",
};

const isJapanese = (lyrics: Lyrics | null): boolean =>
  lyrics != null && lyrics.kind !== "instrumental" && lyrics.language === "ja";

/** Pronunciation labels for every line of the song (`""` for none). */
export function labelsOf(lyrics: Lyrics | null, mode: PronunciationMode, reader: JapaneseReader | null): string[] {
  if (!lyrics || !isJapanese(lyrics)) return [];
  if (lyrics.kind === "plain") return lyrics.lines.map((text) => pronunciationOf(text, mode, reader));
  if (lyrics.kind !== "synced") return [];
  return lyrics.entries.map((entry) => (entry.kind === "line" ? pronunciationOf(entry.text, mode, reader) : ""));
}

export interface Pronunciation {
  labels: string[];
  /** The header toggle, for Japanese lyrics only. */
  button: PronunciationButton | null;
  /** The dictionary offer is showing. */
  promptOpen: boolean;
  /** The reader is being built (labels follow shortly). */
  preparing: boolean;
  dictionary: JapaneseDictionarySnapshot;
}

/**
 * Romaji / hiragana under Japanese lines: the user's mode, the dictionary it
 * needs (offered in place when missing) and its reader, built once the
 * screen has settled — it takes seconds of JS.
 */
export function usePronunciation(lyrics: Lyrics | null): Pronunciation {
  const { settings, updateSettings } = useUserSettings();
  const dictionary = useJapaneseDictionary();
  const [promptWanted, setPromptWanted] = useState(false);
  const installed = dictionary.install === "installed";
  const japanese = isJapanese(lyrics);
  const mode = settings.lyricsPronunciation;

  useEffect(() => {
    if (!installed) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      japaneseDictionary.loadReader().catch(() => {});
    });
    return () => task.cancel();
  }, [installed]);

  const reader = dictionary.reader === "ready" ? japaneseDictionary.currentReader : null;
  const labels = useMemo(() => labelsOf(lyrics, mode, reader), [lyrics, mode, reader]);
  // Once installed, the prompt has done its job.
  const promptOpen = japanese && promptWanted && !installed;

  const button: PronunciationButton | null = japanese
    ? {
        mode,
        installed,
        promptOpen,
        onPress: () => {
          haptics.select();
          if (installed) updateSettings({ lyricsPronunciation: NEXT_MODE[mode] }).catch(() => {});
          else setPromptWanted((open) => !open);
        },
      }
    : null;

  return {
    labels,
    button,
    promptOpen,
    preparing: japanese && installed && mode !== "off" && dictionary.reader === "loading",
    dictionary,
  };
}
