import { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** One full turn of the color field (ms): slow enough to read as drift. */
const TURN_MS = 48_000;
/**
 * A full-screen layer turned to any angle still covers the window once
 * scaled past diagonal ÷ short side: ≈2.44 on a 20:9 phone. These are the
 * portrait constants the backdrop was tuned on.
 */
const FRONT_SCALE = 2.7;
const BACK_SCALE = 3.2;
/** How far past the diagonal the field is scaled: covers its tilt at any angle. */
const OVERSCAN_MARGIN = 1.13;
/** Blur of the back and front layers (the front one sits at 70%). */
const BACK_BLUR = 80;
const FRONT_BLUR = 60;
/** Cross-fade between covers (ms). */
const COVER_FADE_MS = 800;

/**
 * The color field's clock: turns while `animate` (visible, motion allowed).
 * Shared so glass over the backdrop can redraw it in step.
 */
export function useBackgroundTurn(animate: boolean): SharedValue<number> {
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(turn);
      return undefined;
    }
    turn.set(withRepeat(withTiming(turn.get() + 1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [animate, turn]);

  return turn;
}

/**
 * The overscan a full-window layer needs here: diagonal ÷ short side (the
 * worst case of a rotated layer covering the window), plus a margin.
 * Portrait windows — the tall aspect the constants were tuned on — keep them
 * exactly. A wide window needs far less (≈1.98 on 1180×820), so the field
 * stops ballooning, while still covering every edge through the whole turn.
 */
function overscan(width: number, height: number, fixed: number): number {
  const shortSide = Math.min(width, height);
  if (!(shortSide > 0)) return fixed;
  if (height >= width) return fixed;
  return Math.min(fixed, (Math.hypot(width, height) / shortSide) * OVERSCAN_MARGIN);
}

interface Props {
  cover: string | undefined;
  turn: SharedValue<number>;
  /** Blur on top of the backdrop's own — glass frosting what it covers. */
  extraBlur?: number;
  /** Where the field sits (default: filling its parent). */
  style?: ViewStyle;
  /** Cross-fade a new cover in (off for glass mounting over a cover already shown). */
  fade?: boolean;
}

/**
 * Apple Music's living backdrop: the cover, heavily blurred and enlarged,
 * twice — the layers turn in opposite directions so its colors slowly flow
 * into each other. A scrim keeps white lyrics legible on any cover.
 */
export function LyricsBackground({
  cover,
  turn,
  extraBlur = 0,
  style = StyleSheet.absoluteFill,
  fade = true,
}: Readonly<Props>) {
  const transition = fade ? COVER_FADE_MS : 0;
  const window = useWindowDimensions();
  const scales = useMemo(() => {
    const front = overscan(window.width, window.height, FRONT_SCALE);
    return { front, back: front * (BACK_SCALE / FRONT_SCALE) };
  }, [window.width, window.height]);
  const front = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 360}deg` }, { scale: scales.front }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.get() * 360 + 140}deg` }, { scale: scales.back }, { translateX: 40 }],
  }));

  return (
    <View style={style} pointerEvents="none">
      {cover ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <Image
              source={cover}
              style={StyleSheet.absoluteFill}
              blurRadius={BACK_BLUR + extraBlur}
              contentFit="cover"
              transition={transition}
            />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.7 }, front]}>
            <Image
              source={cover}
              style={StyleSheet.absoluteFill}
              blurRadius={FRONT_BLUR + extraBlur}
              contentFit="cover"
              transition={transition}
            />
          </Animated.View>
        </>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: "rgba(12, 0, 30, 0.38)",
  },
});
