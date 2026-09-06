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

type MarqueeProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Scroll speed in pixels per second — constant no matter how long the text is. */
  speed?: number;
  /** Milliseconds the text holds still at the starting position between cycles. */
  delay?: number;
  /** Gap between the two scrolling copies, in pixels. */
  spacer?: number;
  /** Called when the marquee line is tapped (e.g. to copy the text). */
  onPress?: () => void;
};

/** Rounding guard: don't animate for sub-pixel overflows. */
const OVERFLOW_TRESHOLD = 1;

type GroupApi = {
  register: () => number;
  unregister: (id: number) => void;
  report: (id: number, durationMs: number) => void;
  delay: number;
  /**
   * Length of one full cycle (longest member pass + delay). null until every
   * member has measured its text — members hold still until it is known, so
   * the very first pass of every line starts in the same frame.
   */
  cycle: number | null;
};

const GroupContext = createContext<GroupApi | null>(null);

/**
 * Synchronizes sibling Marquees: lines of different lengths scroll at the
 * same speed and can finish at different times, but every pass starts at the
 * same moment and every cycle has the same length, so they repeat in sync.
 */
export function MarqueeGroup({
  children,
  delay = 2500,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const nextId = useRef(0);
  // id -> pass duration; null while that member is still measuring.
  const [records, setRecords] = useState<Map<number, number | null>>(
    () => new Map(),
  );

  const api = useMemo(
    () => ({
      register: () => {
        const id = nextId.current++;
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

  const measured = [...records.values()];
  const allMeasured = records.size > 0 && measured.every((d) => d !== null);
  const cycle = allMeasured
    ? Math.max(0, ...(measured as number[])) + delay
    : null;

  const value = useMemo<GroupApi>(
    () => ({ ...api, delay, cycle }),
    [api, delay, cycle],
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
 * exactly one copy width + spacer and then snaps back to 0 — at that offset
 * the second copy sits exactly where the first was, so the reset is
 * pixel-identical and can never be seen, whatever the timing.
 */
export const Marquee = React.memo(function Marquee({
  text,
  style,
  speed = 60,
  delay,
  spacer = 20,
  onPress,
}: MarqueeProps) {
  const group = useContext(GroupContext);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const holdDelay = group ? group.delay : (delay ?? 2500);

  const overflows =
    containerWidth > 0 &&
    textWidth > 0 &&
    textWidth - containerWidth > OVERFLOW_TRESHOLD;

  const passDuration = ((textWidth + spacer) / speed) * 1000;

  // Group membership: one stable id per mounted line.
  const { register, unregister, report } = group ?? {};
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    if (!register || !unregister) return;
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
    if (!report || idRef.current === null) return;
    report(idRef.current, overflows ? passDuration : 0);
  }, [report, overflows, passDuration]);

  // Length of one full cycle: shared with the group when inside one.
  const cycle = group ? group.cycle : overflows ? passDuration + holdDelay : null;

  useEffect(() => {
    if (!overflows || cycle === null) return;

    // Manual chaining (like react-native-text-ticker's animateScroll):
    // Animated.loop with a native-driven sequence(delay, timing) runs the
    // timing once and never re-arms, leaving the marquee stuck off-position.
    // Passes are scheduled on absolute deadlines so timer jitter never
    // accumulates and sibling marquees stay aligned.
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let current: Animated.CompositeAnimation | null = null;
    let nextStartAt = Date.now() + holdDelay;

    const scroll = () => {
      if (cancelled) return;
      current = Animated.timing(translateX, {
        toValue: -(textWidth + spacer),
        duration: passDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      current.start(({ finished }) => {
        if (cancelled || !finished) return;
        // Copy B now sits exactly where copy A was — snapping back to 0
        // swaps them without any visible change.
        translateX.setValue(0);
        nextStartAt += cycle;
        timeoutId = setTimeout(scroll, Math.max(0, nextStartAt - Date.now()));
      });
    };

    timeoutId = setTimeout(scroll, holdDelay);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      current?.stop();
      translateX.setValue(0);
    };
  }, [
    overflows,
    cycle,
    passDuration,
    textWidth,
    spacer,
    holdDelay,
    translateX,
  ]);

  const content = (
    <>
      {/* In-flow line: reserves the height and shows the text when it fits. */}
      <Text
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
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.track,
            // Transform is always attached (like the original lib) so the
            // native node never re-attaches mid-flight; it stays 0 when the
            // text fits.
            { transform: [{ translateX }] },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[style, !overflows && styles.ghost]}
            onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          >
            {text}
          </Text>
          <View style={{ width: spacer }} />
          <Text numberOfLines={1} style={[style, !overflows && styles.ghost]}>
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
    <Pressable {...lineProps} onPress={onPress}>
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
});
