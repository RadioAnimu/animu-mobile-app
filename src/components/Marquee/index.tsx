import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { scale } from "@/theme/responsive";
import { THEME } from "@/theme";

type MarqueeProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Scroll speed in pixels per second — constant no matter how long the text is. */
  speed?: number;
  /** Gap between the two scrolling copies, in pixels. */
  spacer?: number;
  /** Called when the marquee line is tapped (e.g. to copy the text). */
  onPress?: () => void;
};

/** Standalone hold (outside a {@link MarqueeGroup}): milliseconds at rest. */
const STANDALONE_DELAY = 2500;

/** Rounding guard: don't animate for sub-pixel overflows. */
const OVERFLOW_THRESHOLD = 1;

type GroupApi = {
  register: () => number;
  unregister: (id: number) => void;
  report: (id: number, durationMs: number) => void;
  delay: number;
  /** Shared clock (ms into the current cycle) every member scrolls from. */
  clock: Animated.Value;
};

const GroupContext = createContext<GroupApi | null>(null);

/**
 * One clock that counts 0 -> cycle (in ms) at real-time speed, then wraps to
 * 0 and repeats. Every line derives its offset from the same clock, so lines
 * sharing it can never drift apart — not after timer jitter, not after the
 * app comes back from the background. Pausing (null cycle or not running)
 * parks the clock at 0, i.e. every line at rest; resuming restarts the whole
 * cycle from the top.
 */
function useCycleClock(cycle: number | null, running: boolean) {
  const clock = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (cycle === null || !running) return undefined;

    // Manual chaining (like react-native-text-ticker's animateScroll):
    // Animated.loop with a native-driven animation runs once and never
    // re-arms, leaving the marquee stuck off-position.
    let cancelled = false;
    let current: Animated.CompositeAnimation | null = null;
    const run = () => {
      clock.setValue(0);
      current = Animated.timing(clock, {
        toValue: cycle,
        duration: cycle,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      current.start(({ finished }) => {
        if (!cancelled && finished) run();
      });
    };
    run();

    return () => {
      cancelled = true;
      current?.stop();
      clock.setValue(0);
    };
  }, [clock, cycle, running]);

  return clock;
}

/**
 * Synchronizes sibling Marquees: lines of different lengths scroll at the
 * same speed and can finish at different times, but all of them run off one
 * shared clock, so every pass starts at the same moment and every cycle has
 * the same length.
 */
export function MarqueeGroup({
  children,
  delay = 2500,
}: Readonly<{
  children: ReactNode;
  delay?: number;
}>) {
  const isBackgrounded = useIsBackgrounded();
  const nextId = useRef(0);
  // id -> pass duration; null while that member is still measuring.
  const [records, setRecords] = useState<Map<number, number | null>>(
    () => new Map(),
  );

  const api = useMemo(
    () => ({
      register: () => {
        const id = nextId.current;
        nextId.current += 1;
        setRecords((prev) => new Map(prev).set(id, null));
        return id;
      },
      unregister: (id: number) =>
        setRecords((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        }),
      report: (id: number, durationMs: number) =>
        setRecords((prev) =>
          prev.get(id) === durationMs
            ? prev
            : new Map(prev).set(id, durationMs),
        ),
    }),
    [],
  );

  // Cycle = longest member pass + delay. Unknown until every member has
  // measured (so the first pass of every line starts together), and absent
  // when nothing overflows (nothing to scroll).
  const measured = [...records.values()];
  const allMeasured = records.size > 0 && measured.every((d) => d !== null);
  const longest = allMeasured ? Math.max(0, ...(measured as number[])) : 0;
  const cycle = longest > 0 ? longest + delay : null;

  // Hidden app: stop the clock entirely (every line back to rest). Native
  // animations keep running in the background on Android, burning CPU.
  const clock = useCycleClock(cycle, !isBackgrounded);

  const value = useMemo<GroupApi>(
    () => ({ ...api, delay, clock }),
    [api, delay, clock],
  );

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}

/**
 * Lightweight marquee built on the built-in Animated API (native driver).
 *
 * Like react-native-text-ticker, the scrolling layer holds TWO copies of the
 * text separated by `spacer`, inside a horizontal ScrollView whose content
 * axis is unbounded (so the text can never wrap). Each pass scrolls by
 * exactly one copy width + spacer and then rests there until the cycle wraps
 * back to 0 — at that offset the second copy sits exactly where the first
 * was, so the reset is pixel-identical and can never be seen.
 */
export const Marquee = React.memo(function Marquee({
  text,
  style,
  speed = scale(60),
  spacer = scale(20),
  onPress,
}: MarqueeProps) {
  const group = useContext(GroupContext);
  const isBackgrounded = useIsBackgrounded();
  // null until the first layout pass: an unmeasured line must not tell its
  // group "fits", or the group would start before every line is known.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [measuredTextWidth, setMeasuredTextWidth] = useState<number | null>(
    null,
  );
  const textWidth = measuredTextWidth ?? 0;
  const measured = containerWidth !== null && measuredTextWidth !== null;

  const holdDelay = group ? group.delay : STANDALONE_DELAY;

  const overflows =
    containerWidth !== null &&
    containerWidth > 0 &&
    textWidth > 0 &&
    textWidth - containerWidth > OVERFLOW_THRESHOLD;

  const passDuration = ((textWidth + spacer) / speed) * 1000;

  // Group membership: one stable id per mounted line.
  const { register, unregister, report } = group ?? {};
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    if (!register || !unregister) return undefined;
    const id = register();
    idRef.current = id;
    return () => {
      idRef.current = null;
      unregister(id);
    };
  }, [register, unregister]);

  // Share the pass duration with the group (0 when the text fits — excluded
  // from the cycle but still counted as "measured").
  useEffect(() => {
    if (!report || idRef.current === null || !measured) return;
    report(idRef.current, overflows ? passDuration : 0);
  }, [report, measured, overflows, passDuration]);

  // Standalone lines run their own clock; group members use the shared one.
  const ownClock = useCycleClock(
    !group && overflows ? passDuration + holdDelay : null,
    !isBackgrounded,
  );
  const clock = group ? group.clock : ownClock;

  // Rest during the hold, scroll one copy + spacer at constant speed, then
  // rest (looking exactly like offset 0) until the cycle wraps.
  const translateX = useMemo(() => {
    const end = overflows ? -(textWidth + spacer) : 0;
    // A zero hold would repeat input 0, which native interpolation may reject.
    const hold = holdDelay > 0;
    return clock.interpolate({
      inputRange: hold
        ? [0, holdDelay, holdDelay + passDuration]
        : [0, passDuration],
      outputRange: hold ? [0, 0, end] : [0, end],
      extrapolate: "clamp",
    });
  }, [clock, holdDelay, passDuration, overflows, textWidth, spacer]);

  const content = (
    <>
      {/* In-flow line: reserves the height and shows the text when it fits. */}
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[style, overflows && styles.ghost]}
      >
        {text}
      </Text>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.track,
            // Transform is always attached (like the original lib); it
            // interpolates to 0 when the text fits.
            { transform: [{ translateX }] },
          ]}
        >
          <Text
            maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
            numberOfLines={1}
            style={[style, !overflows && styles.ghost]}
            onLayout={(e) => setMeasuredTextWidth(e.nativeEvent.layout.width)}
          >
            {text}
          </Text>
          <View style={{ width: spacer }} />
          <Text
            maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
            numberOfLines={1}
            style={[style, !overflows && styles.ghost]}
          >
            {text}
          </Text>
        </Animated.View>
      </ScrollView>
    </>
  );

  const lineProps = {
    style: styles.container,
    onLayout: (e: LayoutChangeEvent) =>
      setContainerWidth(e.nativeEvent.layout.width),
  };

  return onPress ? (
    <Pressable
      onLayout={lineProps.onLayout}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      // Subtle press feedback (dims like the history rows' TouchableOpacity).
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View {...lineProps}>{content}</View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  track: {
    flexDirection: "row",
  },
  ghost: {
    opacity: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
