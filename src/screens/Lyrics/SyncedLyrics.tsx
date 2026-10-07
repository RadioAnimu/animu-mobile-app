import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, Text, View, type LayoutChangeEvent, type ListRenderItem } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { entryIndexAt, entryKey } from "@/core/lyrics/lrc";
import type { LyricEntry } from "@/core/lyrics/types";
import { useScreenReader } from "@/hooks/useScreenReader";
import {
  LyricRow,
  UNKNOWN_INDEX,
  type FollowTarget,
  type ListMotion,
  useRowOffset,
  DEPTH_LIMIT,
} from "@/screens/Lyrics/LyricRow";
import { LYRIC, styles } from "@/screens/Lyrics/styles";

/** After the user stops scrolling, the list returns to the song after this. */
const RESUME_FOLLOW_MS = 3_000;

/** A row's distance from the lit line, clamped (nothing lit yet: all sharp, none lit). */
function depthOf(index: number, active: number): number {
  if (active === UNKNOWN_INDEX) return 1;
  return Math.max(-DEPTH_LIMIT, Math.min(DEPTH_LIMIT, index - Math.max(active, 0)));
}

/** One pending timeout, replaced by every new `schedule`. */
class DelayedCall {
  private timer: ReturnType<typeof setTimeout> | null = null;

  schedule(run: () => void, delayMs: number): void {
    this.cancel();
    this.timer = setTimeout(run, delayMs);
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

interface Props {
  entries: LyricEntry[];
  /** Pronunciation label per entry (`""` for none). */
  labels: readonly string[];
  position: SharedValue<number>;
  known: boolean;
  reduceMotion: boolean;
  /** Rendered after the last line (credits). */
  footer: ReactNode;
}

/**
 * Synced lyrics that follow the song: the active line sits in the upper
 * third, and each change scrolls the list with a cascade — rows further
 * down start moving later, the Apple Music ripple. Dragging browses freely;
 * the list returns to the song a few seconds after the finger lifts (or on
 * a tap). The active entry is derived on the UI thread from the heard
 * position, every frame.
 */
export function SyncedLyrics({ entries, labels, position, known, reduceMotion, footer }: Readonly<Props>) {
  const screenReader = useScreenReader();
  const [active, setActive] = useState(UNKNOWN_INDEX);
  const [browsingNow, setBrowsingNow] = useState(false);

  const follow = useSharedValue<FollowTarget>({ y: 0, active: 0, seq: 0, instant: true });
  const browsing = useSharedValue(false);
  const manual = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const activeIndex = useSharedValue(UNKNOWN_INDEX);
  const viewport = useSharedValue(0);
  const tops = useSharedValue<number[]>([]);
  const contentHeight = useSharedValue(0);
  const knownShared = useSharedValue(known);

  const motion = useMemo<ListMotion>(
    () => ({ follow, browsing, manual, activeIndex, viewport, reduceMotion }),
    [follow, browsing, manual, activeIndex, viewport, reduceMotion],
  );

  // Only what the worklets need: start/end per entry.
  const spans = useMemo(() => entries.map(({ startMs, endMs }) => ({ startMs, endMs })), [entries]);

  useEffect(() => {
    knownShared.set(known);
  }, [known, knownShared]);

  // ─── Follow: the active entry, every frame, on the UI thread ───
  useAnimatedReaction(
    () => (knownShared.get() && !Number.isNaN(position.get()) ? entryIndexAt(spans, position.get()) : UNKNOWN_INDEX),
    (index, previous) => {
      if (index === previous) return;
      activeIndex.set(index);
      const rows = tops.get();
      if (rows.length > 0) {
        const anchor = viewport.get() * LYRIC.ANCHOR;
        const row = Math.min(Math.max(index, 0), rows.length - 1);
        follow.set({
          y: rows[row] - anchor,
          active: row,
          seq: follow.get().seq + 1,
          instant: previous === null,
        });
      }
      scheduleOnRN(setActive, index);
    },
    [spans],
  );

  // ─── Layout: row tops feed the follow target ───
  const rowTops = useRef<number[]>([]);
  const flushScheduled = useRef(false);
  const flushLayout = useCallback(() => {
    flushScheduled.current = false;
    tops.set([...rowTops.current]);
    const anchor = viewport.get() * LYRIC.ANCHOR;
    const target = follow.get();
    const row = Math.min(Math.max(target.active, 0), rowTops.current.length - 1);
    if (row < 0) return;
    // A relayout (label toggle, rotation, text size) re-places without a ripple.
    follow.set({ y: rowTops.current[row] - anchor, active: row, seq: target.seq + 1, instant: true });
  }, [follow, tops, viewport]);

  const onRowLayout = useCallback(
    (index: number, top: number) => {
      rowTops.current[index] = top;
      if (flushScheduled.current) return;
      flushScheduled.current = true;
      requestAnimationFrame(flushLayout);
    },
    [flushLayout],
  );

  useEffect(() => {
    rowTops.current = rowTops.current.slice(0, entries.length);
  }, [entries.length]);

  const onViewportLayout = (event: LayoutChangeEvent) => {
    viewport.set(event.nativeEvent.layout.height);
    flushLayout();
  };

  // ─── Browsing ───
  const [resume] = useState(() => new DelayedCall());
  const resumeFollow = useCallback(() => {
    resume.cancel();
    cancelAnimation(manual);
    browsing.set(false);
    setBrowsingNow(false);
    follow.set({ ...follow.get(), seq: follow.get().seq + 1, instant: false });
  }, [browsing, follow, manual, resume]);
  const scheduleResume = useCallback(() => resume.schedule(resumeFollow, RESUME_FOLLOW_MS), [resume, resumeFollow]);
  const holdResume = useCallback(() => resume.cancel(), [resume]);

  useEffect(() => () => resume.cancel(), [resume]);

  const gesture = useMemo(() => {
    const bounds = () => {
      "worklet";
      const anchor = viewport.get() * LYRIC.ANCHOR;
      return { min: -anchor, max: Math.max(-anchor, contentHeight.get() - anchor) };
    };
    const pan = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onStart(() => {
        if (!browsing.get()) manual.set(follow.get().y);
        cancelAnimation(manual);
        dragStart.set(manual.get());
        browsing.set(true);
        scheduleOnRN(holdResume);
        scheduleOnRN(setBrowsingNow, true);
      })
      .onUpdate((event) => {
        const { min, max } = bounds();
        manual.set(Math.min(max, Math.max(min, dragStart.get() - event.translationY)));
      })
      .onEnd((event) => {
        const { min, max } = bounds();
        manual.set(withDecay({ velocity: -event.velocityY, clamp: [min, max] }));
        scheduleOnRN(scheduleResume);
      });
    const tap = Gesture.Tap().onEnd(() => {
      if (browsing.get()) scheduleOnRN(resumeFollow);
    });
    return Gesture.Race(pan, tap);
  }, [browsing, contentHeight, dragStart, follow, holdResume, manual, resumeFollow, scheduleResume, viewport]);

  // VoiceOver / TalkBack: a plain list the reader can walk, current line marked.
  if (screenReader) {
    return <ReaderList entries={entries} labels={labels} active={active} footer={footer} />;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.body} onLayout={onViewportLayout}>
        <Animated.View
          style={styles.column}
          onLayout={(event) => {
            contentHeight.set(event.nativeEvent.layout.height);
          }}
        >
          {entries.map((entry, index) => (
            <LyricRow
              key={entryKey(entry)}
              entry={entry}
              index={index}
              label={labels[index] ?? ""}
              depth={depthOf(index, active)}
              browsing={browsingNow}
              position={position}
              motion={motion}
              onRowLayout={onRowLayout}
            />
          ))}
          <FooterRow motion={motion}>{footer}</FooterRow>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** The credits ride along with the last rows. */
function FooterRow({ motion, children }: Readonly<{ motion: ListMotion; children: ReactNode }>) {
  const y = useRowOffset(motion, Number.MAX_SAFE_INTEGER);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -y.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The lines as a list a screen reader walks; the current one is marked selected. */
function ReaderList({
  entries,
  labels,
  active,
  footer,
}: Readonly<{ entries: LyricEntry[]; labels: readonly string[]; active: number; footer: ReactNode }>) {
  const rows = useMemo(
    () =>
      entries.flatMap((entry, index) =>
        entry.kind === "line" ? [{ key: entryKey(entry), index, text: entry.text, label: labels[index] ?? "" }] : [],
      ),
    [entries, labels],
  );
  const renderRow = useCallback<ListRenderItem<ReaderRow>>(
    ({ item }) => <ReaderLine row={item} current={item.index === active} />,
    [active],
  );
  return (
    <FlatList
      data={rows}
      extraData={active}
      keyExtractor={(row) => row.key}
      contentContainerStyle={styles.column}
      ListFooterComponent={<>{footer}</>}
      renderItem={renderRow}
    />
  );
}

interface ReaderRow {
  key: string;
  index: number;
  text: string;
  label: string;
}

function ReaderLine({ row, current }: Readonly<{ row: ReaderRow; current: boolean }>) {
  return (
    <Text style={current ? styles.readerLine : styles.readerLineDim} accessibilityState={{ selected: current }}>
      {row.text}
      {row.label ? `\n${row.label}` : ""}
    </Text>
  );
}
