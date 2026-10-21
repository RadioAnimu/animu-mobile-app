import { useLayoutEffect, useRef, useState } from "react";
import { Animated } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MOTION } from "@/theme/motion";

/**
 * Opacity for the form body that changes between two steps of one flow. When
 * `step` changes, the new body (already mounted, so its input can take focus
 * in the same frame) fades in over MOTION.DURATION.NORMAL; Reduce Motion
 * switches immediately. Only opacity moves: the body never slides, resizes
 * or overlaps an outgoing tree, so the keyboard and scroll position stay put.
 *
 * The first render never animates: entrance motion belongs to the caller.
 */
export function useStepFade(step: string): Animated.Value {
  const [opacity] = useState(() => new Animated.Value(1));
  const reduceMotion = useReducedMotion();
  const previous = useRef(step);
  // Read at the change, not a dependency: toggling the setting mid-fade must
  // not cut the running animation short.
  const reduceMotionRef = useRef(reduceMotion);
  useLayoutEffect(() => {
    reduceMotionRef.current = reduceMotion;
  });

  // Layout effect: the new body must start transparent before it first paints,
  // or it would flash at full opacity for a frame and then drop to zero.
  useLayoutEffect(() => {
    if (previous.current === step) return undefined;
    previous.current = step;
    if (reduceMotionRef.current) {
      opacity.setValue(1);
      return undefined;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: MOTION.DURATION.NORMAL,
      easing: MOTION.EASING.ENTER,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [step, opacity]);

  return opacity;
}
