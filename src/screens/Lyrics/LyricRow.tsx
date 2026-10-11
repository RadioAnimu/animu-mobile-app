import { memo } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import type { LyricEntry, LyricLine } from "@/core/lyrics";
import type { LineLabel } from "@/core/lyrics/pronunciation";
import { SegmentColumns, SungColumns, SungWords } from "@/screens/Lyrics/Segments";
import { LYRIC, styles } from "@/screens/Lyrics/styles";

/** `activeIndex` while the heard position is not known. */
export const UNKNOWN_INDEX = -2;

/** Where every row should scroll to, and why (see `SyncedLyrics`). */
export interface FollowTarget {
  y: number;
  /** The entry the scroll is following. */
  active: number;
  /** Bumped on every new target; rows animate once per bump. */
  seq: number;
  /** Jump without the cascade (layout changes, reduced motion). */
  instant: boolean;
}

/** Shared animation state of the whole list, owned by `SyncedLyrics`. */
export interface ListMotion {
  follow: SharedValue<FollowTarget>;
  /** The user is scrolling: rows track `manual` instead of the song. */
  browsing: SharedValue<boolean>;
  manual: SharedValue<number>;
  activeIndex: SharedValue<number>;
  /** Height of the lyrics viewport. */
  viewport: SharedValue<number>;
  reduceMotion: boolean;
}

/** Each row further from the active line starts later: Apple's cascade. */
const STAGGER_MS = 42;
const STAGGER_ROWS = 8;
const SPRING = { damping: 26, stiffness: 160, mass: 1 };
const FADE_MS = 280;

/**
 * Opacity by distance from the lit line, Apple Music's depth: the next line
 * sharp but dim, lines further away fainter, sung lines fainter still. While
 * browsing every line reads; before the position is known none is lit.
 */
function emphasisOf(index: number, active: number, browsing: boolean, interlude: boolean): number {
  "worklet";
  if (interlude) return active === index ? 1 : 0;
  if (active === index) return 1;
  if (browsing) return 0.62;
  if (active === UNKNOWN_INDEX) return 0.55;
  const distance = index - active;
  if (distance === 1) return 0.5;
  if (distance > 1) return Math.max(0.24, 0.42 - 0.04 * distance);
  return distance === -1 ? 0.22 : 0.16;
}

/** Blur (px) by distance; sharp around the lit line and while browsing. */
function blurOf(depth: number, browsing: boolean): number {
  if (browsing || depth === 0 || depth === 1) return 0;
  if (depth < 0) return depth === -1 ? 1.5 : 3;
  return Math.min(5, (depth - 1) * 1.5);
}

/** Rows this far away all look the same: no re-render as the song moves on. */
export const DEPTH_LIMIT = 5;

/**
 * A row's scroll offset: it tracks the finger while browsing, and otherwise
 * springs to each new follow target after a delay that grows with its
 * distance from the active line.
 */
export function useRowOffset(motion: ListMotion, index: number): SharedValue<number> {
  const { follow, browsing, manual, reduceMotion } = motion;
  const y = useSharedValue(0);

  useAnimatedReaction(
    () => (browsing.get() ? manual.get() : null),
    (offset) => {
      if (offset !== null) y.set(offset);
    },
  );

  useAnimatedReaction(
    () => follow.get(),
    (target, previous) => {
      if (browsing.get() || (previous && target.seq === previous.seq)) return;
      // A row that just mounted starts where the list is.
      if (!previous || target.instant || reduceMotion) {
        y.set(target.y);
        return;
      }
      const forward = target.active >= previous.active;
      const distance = forward ? index - target.active : target.active - index;
      const delay = Math.min(Math.max(distance, 0), STAGGER_ROWS) * STAGGER_MS;
      y.set(withDelay(delay, withSpring(target.y, SPRING)));
    },
  );

  return y;
}

interface RowProps {
  entry: LyricEntry;
  index: number;
  /** The reading (romaji / hiragana), `null` for none. */
  label: LineLabel | null;
  /**
   * Distance from the lit line (React side: word wipe, blur, accessibility),
   * clamped to ±{@link DEPTH_LIMIT}; `0` is the lit line.
   */
  depth: number;
  /** The user is scrolling (React side: blur off). */
  browsing: boolean;
  position: SharedValue<number>;
  motion: ListMotion;
  onRowLayout: (index: number, top: number, height: number) => void;
}

/**
 * One lyric line (or interlude). Its vertical position follows the list's
 * target with a per-row delay, so a line change ripples down the screen;
 * opacity, the edge fade and the active line's emphasis run on the UI
 * thread.
 */
export const LyricRow = memo(function LyricRow({
  entry,
  index,
  label,
  depth,
  browsing: browsingNow,
  position,
  motion,
  onRowLayout,
}: Readonly<RowProps>) {
  const { activeIndex, browsing, viewport, reduceMotion } = motion;
  const isActive = depth === 0;
  // Android 12+ blurs natively; elsewhere (iOS keeps view filters behind an
  // experimental flag) the fade alone carries the depth.
  const interlude = entry.kind === "interlude";
  const blur = interlude ? 0 : blurOf(depth, browsingNow);
  const y = useRowOffset(motion, index);
  const top = useSharedValue(0);
  const height = useSharedValue(0);
  const emphasis = useSharedValue(0);

  useAnimatedReaction(
    () => emphasisOf(index, activeIndex.get(), browsing.get(), interlude),
    (next, previous) => {
      if (next === previous) return;
      emphasis.set(previous === null ? next : withTiming(next, { duration: FADE_MS }));
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    // Fade at the viewport's edges (no mask needed: rows fade themselves).
    // At the top: full at the lit line's place, gone once the row is above
    // the edge — a line leaving under the header is faint before it is cut.
    const screenTop = top.get() - y.get();
    const edge = LYRIC.EDGE_FADE;
    const fadeTop = interpolate(screenTop, [-height.get(), LYRIC.ANCHOR], [0, 1], Extrapolation.CLAMP);
    const fadeBottom = interpolate(screenTop, [viewport.get() - edge, viewport.get()], [1, 0], Extrapolation.CLAMP);
    // The lit line stands a touch larger than the rest (follows the fade).
    const scale = reduceMotion || interlude ? 1 : interpolate(emphasis.get(), [0.5, 1], [0.97, 1], Extrapolation.CLAMP);
    return {
      opacity: emphasis.get() * Math.min(fadeTop, fadeBottom),
      transform: [{ translateY: -y.get() }, { scale }],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    top.set(layout.y);
    height.set(layout.height);
    onRowLayout(index, layout.y, layout.height);
  };

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.row, { transformOrigin: "left center" }, animatedStyle]}
      accessible={!interlude}
      accessibilityLabel={entry.kind === "line" ? entry.text : undefined}
      accessibilityState={{ selected: isActive }}
    >
      {entry.kind === "interlude" ? (
        <Interlude startMs={entry.startMs} endMs={entry.endMs} position={position} />
      ) : (
        <View style={blur > 0 ? { filter: [{ blur }] } : undefined}>
          <LineContent line={entry} label={label} sung={isActive} position={position} />
        </View>
      )}
    </Animated.View>
  );
});

/**
 * A line and its reading: word by word in columns (each word over its
 * reading), or the line with one reading under it; while sung, words fill
 * with the word timing.
 */
function LineContent({
  line,
  label,
  sung,
  position,
}: Readonly<{ line: LyricLine; label: LineLabel | null; sung: boolean; position: SharedValue<number> }>) {
  if (label?.kind === "words") {
    return sung && line.words ? (
      <SungColumns segments={label.segments} words={line.words} position={position} />
    ) : (
      <SegmentColumns segments={label.segments} />
    );
  }
  return (
    <>
      {sung && line.words ? (
        <SungWords words={line.words} position={position} />
      ) : (
        <Text maxFontSizeMultiplier={1.4} style={styles.lineText}>
          {line.text}
        </Text>
      )}
      {label ? (
        <Text maxFontSizeMultiplier={1.4} style={styles.label}>
          {label.text}
        </Text>
      ) : null}
    </>
  );
}

/** Three dots that fill over the break, breathe, and swell away at its end. */
function Interlude({
  startMs,
  endMs,
  position,
}: Readonly<{ startMs: number; endMs: number; position: SharedValue<number> }>) {
  const span = Math.max(1, endMs - startMs);
  const group = useAnimatedStyle(() => {
    const elapsed = position.get() - startMs;
    const left = endMs - position.get();
    const breathe = 1 + 0.07 * Math.sin((elapsed / 1_400) * Math.PI * 2);
    const ending = interpolate(left, [0, 450], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: 1 - ending,
      transform: [{ scale: breathe + 0.25 * ending }],
    };
  });
  return (
    <Animated.View style={[styles.dots, group]} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 1, 2].map((dot) => (
        <Dot key={dot} dot={dot} startMs={startMs} span={span} position={position} />
      ))}
    </Animated.View>
  );
}

function Dot({
  dot,
  startMs,
  span,
  position,
}: Readonly<{ dot: number; startMs: number; span: number; position: SharedValue<number> }>) {
  const style = useAnimatedStyle(() => {
    const progress = (position.get() - startMs) / span;
    return { opacity: 0.3 + 0.7 * Math.min(1, Math.max(0, progress * 3 - dot)) };
  });
  return <Animated.View style={[styles.dot, style]} />;
}
