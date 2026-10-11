import { useMemo, useState } from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { LyricWord } from "@/core/lyrics";
import { timeSegments, type LabelSegment, type TimedSegment } from "@/core/lyrics/segments";
import { LYRIC, styles } from "@/screens/Lyrics/styles";

/** Each segment keyed by where it starts in its line (a stable identity). */
function keyed<T extends { text: string }>(segments: readonly T[]): (T & { key: string })[] {
  let offset = 0;
  return segments.map((segment) => {
    const key = `${offset}:${segment.text}`;
    offset += segment.text.length;
    return { ...segment, key };
  });
}

/** Room between two words a space separates. */
const WORD_SPACE = LYRIC.SIZE * 0.26;

/**
 * A line as columns, each word over its reading (Apple Music's layout): a
 * column is as wide as the wider of the two, so the Japanese stays together
 * where readings are shorter and opens up where they are longer.
 */
export function SegmentColumns({
  segments,
  textStyle = styles.lineText,
}: Readonly<{ segments: readonly LabelSegment[]; textStyle?: StyleProp<TextStyle> }>) {
  return (
    <View style={styles.segments}>
      {keyed(segments).map((segment) => (
        <View key={segment.key} style={[styles.segment, segment.spaceAfter && { marginRight: WORD_SPACE }]}>
          <Text maxFontSizeMultiplier={1.4} style={textStyle}>
            {segment.text}
          </Text>
          {segment.label ? (
            <Text maxFontSizeMultiplier={1.4} style={[styles.label, styles.segmentLabel]}>
              {segment.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** The sung line, word by word: each fills as it is sung (no readings). */
export function SungWords({ words, position }: Readonly<{ words: readonly LyricWord[]; position: SharedValue<number> }>) {
  return (
    <View style={styles.segments}>
      {words.map((word) => (
        <SungText key={`${word.startMs}:${word.text}`} piece={word} position={position} />
      ))}
    </View>
  );
}

/**
 * The sung line in columns: the word timing spread over the words the
 * readings are split into — each word fills as it is sung, and its reading
 * lights with it. Falls back to plain columns when they do not line up.
 */
export function SungColumns({
  segments,
  words,
  position,
}: Readonly<{ segments: readonly LabelSegment[]; words: readonly LyricWord[]; position: SharedValue<number> }>) {
  const timed = useMemo(() => timeSegments(segments, words), [segments, words]);
  if (!timed) return <SegmentColumns segments={segments} />;
  return (
    <View style={styles.segments}>
      {keyed(timed).map((segment) => (
        <SungText key={segment.key} piece={segment} label={segment.label} position={position} />
      ))}
    </View>
  );
}

type SungPiece = Pick<TimedSegment, "text" | "startMs" | "endMs" | "spaceAfter">;

/** A word that fills (and rises a hair) as it is sung; its reading lights with it. */
function SungText({ piece, label, position }: Readonly<{ piece: SungPiece; label?: string; position: SharedValue<number> }>) {
  const [width, setWidth] = useState(0);
  const span = Math.max(1, piece.endMs - piece.startMs);

  const fill = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, (position.get() - piece.startMs) / span));
    return { width: width * progress };
  });
  const lift = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, (position.get() - piece.startMs) / span));
    return { transform: [{ translateY: -1.5 * progress }] };
  });
  const lit = useAnimatedStyle(() => ({ opacity: position.get() >= piece.startMs ? 1 : 0.4 }));

  return (
    <Animated.View style={[styles.segment, piece.spaceAfter && { marginRight: WORD_SPACE }, lift]}>
      <View>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[styles.lineText, styles.wordDim]}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {piece.text}
        </Text>
        <Animated.View style={[styles.wordFill, fill]} pointerEvents="none">
          <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[styles.lineText, { width }]}>
            {piece.text}
          </Text>
        </Animated.View>
      </View>
      {label ? (
        <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.label, styles.segmentLabel, lit]}>
          {label}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}
