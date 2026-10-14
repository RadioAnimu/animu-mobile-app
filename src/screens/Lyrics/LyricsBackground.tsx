import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
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
 * A full-screen layer turned to any angle still covers the screen once
 * scaled past diagonal ÷ width (≈ 2.44 on a 20:9 phone).
 */
const FRONT_SCALE = 2.7;
const BACK_SCALE = 3.2;
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
  const front = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 360}deg` }, { scale: FRONT_SCALE }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.get() * 360 + 140}deg` }, { scale: BACK_SCALE }, { translateX: 40 }],
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
