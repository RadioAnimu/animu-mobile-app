import { useEffect, useState } from "react";
import { Animated } from "react-native";

import { MOTION } from "@/theme/motion";

/**
 * Enter/exit driver shared by every overlay (sheets, dialogs): `progress`
 * runs 0 → 1 on the native driver when `visible` turns on (NORMAL, easing
 * in) and back to 0 when it turns off (FAST, easing out — a dismissal should
 * get out of the way quicker than an arrival), and `mounted` stays true
 * until that exit has finished so the surface can play it before its native
 * Modal unmounts.
 */
export function usePresence(visible: boolean): {
  mounted: boolean;
  progress: Animated.Value;
} {
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!mounted) return undefined;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? MOTION.DURATION.NORMAL : MOTION.DURATION.FAST,
      easing: visible ? MOTION.EASING.ENTER : MOTION.EASING.EXIT,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, mounted, progress]);

  return { mounted, progress };
}
