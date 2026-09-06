import React, { memo, useCallback } from "react";
import { Text, View } from "react-native";
import { useSungWordIndex } from "../../hooks/useKaraoke";
import {
  pronunciationLabel,
  type LabelMode,
} from "../../core/lyrics/romaji";
import type { LyricLine, LyricWord } from "../../core/lyrics/types";
import { styles } from "./styles";

// ─── Karaoke rows ───
//
// Static rows are memoized on primitives (times, booleans), so the 60fps
// word clock never touches them. Only the ACTIVE row re-renders (on word
// boundary), which is what keeps a 100-line list smooth.
//
// Label re-renders across the whole list ride on the FlatList's
// `extraData` (see LyricsSheet): a mode change or the dictionary
// tokenizer finishing its build flips it once, and rows re-render with
// the new readings.

export type LyricLabelMode = LabelMode;
export const lyricLabel = pronunciationLabel;

interface RowProps {
  line: LyricLine;
  isActive: boolean;
  isPast: boolean;
  plain: boolean;
  labelMode: LyricLabelMode;
  startTimeMs: number | null;
  isPlaying: boolean;
}

export const LyricRow = memo(function LyricRow({
  line,
  isActive,
  isPast,
  plain,
  labelMode,
  startTimeMs,
  isPlaying,
}: RowProps) {
  const label = labelMode === "off" ? "" : lyricLabel(labelMode, line.text);

  if (plain) {
    return (
      <View style={styles.row}>
        <Text style={styles.linePlain}>{line.text}</Text>
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={styles.row}>
        {label !== "" && <Text style={styles.romajiStatic}>{label}</Text>}
        <Text style={isPast ? styles.linePast : styles.lineFuture}>
          {line.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {label !== "" && <Text style={styles.romajiActive}>{label}</Text>}
      <ActiveLine
        words={line.words}
        startTimeMs={startTimeMs}
        isPlaying={isPlaying}
      />
    </View>
  );
});

interface ActiveLineProps {
  words: LyricWord[];
  startTimeMs: number | null;
  isPlaying: boolean;
}

function ActiveLine({ words, startTimeMs, isPlaying }: ActiveLineProps) {
  const wordIndex = useSungWordIndex(
    words,
    { startTimeMs, isPlaying },
    words.length > 1,
  );

  const renderSpan = useCallback(
    (word: LyricWord, index: number) => {
      const suffix = index < words.length - 1 ? " " : "";
      return (
        <Text
          key={`${word.startMs}-${index}`}
          style={index <= wordIndex ? styles.wordSung : styles.wordUpcoming}
        >
          {word.text}
          {suffix}
        </Text>
      );
    },
    [wordIndex, words.length],
  );

  // A line without word splits highlights as one block the moment it's active.
  if (words.length <= 1) {
    return <Text style={styles.lineActive}>{words[0]?.text ?? ""}</Text>;
  }

  return <Text style={styles.lineActive}>{words.map(renderSpan)}</Text>;
}
