import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

interface Options {
  /** How dim the pulse dips (defaults to the shared "calculating" pulse). */
  min?: number;
  /** Length of each half of the pulse, in ms. */
  duration?: number;
}

/**
 * "Calculating" pulse: fades an Animated.Value towards `min` and back while
 * `active`, so unknown/working-on-it state reads as intent instead of broken.
 * Stops — and resets to full opacity — whenever `active` turns false, so
 * renderers can hide behind `active` without stale mid-pulse opacity.
 */
export function useBlink(active: boolean, { min = 0.35, duration = 650 }: Options = {}) {
  const [blink] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: min,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      blink.setValue(1);
    };
  }, [active, blink, min, duration]);

  return blink;
}
