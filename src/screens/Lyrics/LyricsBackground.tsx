import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  cancelAnimation,
  Easing,
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

interface Props {
  cover: string | undefined;
  /** Drift while true (visible, motion allowed). */
  animate: boolean;
}

/**
 * Apple Music's living backdrop: the cover, heavily blurred and enlarged,
 * twice — the layers turn in opposite directions so its colors slowly flow
 * into each other. A scrim keeps white lyrics legible on any cover.
 */
export function LyricsBackground({ cover, animate }: Readonly<Props>) {
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(turn);
      return undefined;
    }
    turn.set(withRepeat(withTiming(turn.get() + 1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [animate, turn]);

  const front = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 360}deg` }, { scale: FRONT_SCALE }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.get() * 360 + 140}deg` }, { scale: BACK_SCALE }, { translateX: 40 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cover ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <Image source={cover} style={StyleSheet.absoluteFill} blurRadius={80} contentFit="cover" transition={800} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.7 }, front]}>
            <Image source={cover} style={StyleSheet.absoluteFill} blurRadius={60} contentFit="cover" transition={800} />
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
