import { useEffect, useState } from "react";
import { Animated, Easing } from "react-native";

/** How dim the "calculating" pulse dips. */
const BLINK_MIN = 0.35;
/** Length of each half of the pulse, in ms. */
const BLINK_HALF_MS = 650;

/**
 * "Calculating" pulse: fades an Animated.Value towards `min` and back while
 * `active`, so unknown/working-on-it state reads as intent instead of broken.
 * Stops — and resets to full opacity — whenever `active` turns false, so
 * renderers can hide behind `active` without stale mid-pulse opacity.
 */
export function useBlink(active: boolean) {
  const [blink] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: BLINK_MIN,
          duration: BLINK_HALF_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: BLINK_HALF_MS,
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
  }, [active, blink]);

  return blink;
}
