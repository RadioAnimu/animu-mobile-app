import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Live "Reduce Motion" (iOS) / "Remove animations" (Android) preference.
 *
 * When on, spatial movement (slides, rises, bobbing, scale pops) gives way to
 * plain fades or instant state changes; feedback that carries meaning — a
 * spinner, a progress bar — keeps running.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
