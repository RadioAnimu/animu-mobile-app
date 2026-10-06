import { useEffect, useState } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MOTION } from "@/theme/motion";

/**
 * How far the software keyboard reaches ABOVE the bottom safe area — the
 * extra bottom padding a surface needs on top of its normal safe-area
 * padding to keep its content visible while typing.
 *
 * Both platforms report that same quantity, so callers can always add it to
 * `insets.bottom + gap` without double counting:
 * - iOS reports the full keyboard frame, which covers the home-indicator
 *   inset, so the inset is subtracted here.
 * - Android (RN 0.86, edge-to-edge) already reports `ime - systemBars`, i.e.
 *   the part above the navigation bar.
 *
 * We don't use RN's `KeyboardAvoidingView`: on Android edge-to-edge it
 * recomputes padding from the hide event's `screenY` — which is reported
 * wrong in edge-to-edge — and leaves a transparent gap behind after the
 * keyboard closes. Here the hide event always resets to 0.
 *
 * On iOS the layout change rides the keyboard's own animation (its duration
 * and curve from the event), so the content moves in lockstep with the
 * keyboard instead of chasing it. Android only gets reliable heights from
 * `didShow`/`didHide`, so it uses the app's fast standard ease.
 *
 * Screens whose scroll view already handles iOS through
 * `automaticallyAdjustKeyboardInsets` should enable this on Android only.
 */
export function useKeyboardPadding(enabled: boolean): number {
  const [height, setHeight] = useState(() => Keyboard.metrics()?.height ?? 0);
  const { bottom: bottomInset } = useSafeAreaInsets();

  useEffect(() => {
    if (!enabled) {
      setHeight(0);
      return undefined;
    }
    // A modal can open while another input's keyboard is already visible.
    // Seed from the native keyboard cache instead of waiting for a new show.
    setHeight(Keyboard.metrics()?.height ?? 0);

    const animate = (event?: KeyboardEvent) => {
      if (Platform.OS === "ios" && event?.duration) {
        LayoutAnimation.configureNext({
          duration: event.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
        return;
      }
      LayoutAnimation.configureNext({
        duration: MOTION.DURATION.FAST,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
    };

    const onShow = (event: KeyboardEvent) => {
      animate(event);
      setHeight(event.endCoordinates.height);
    };
    const onHide = (event: KeyboardEvent) => {
      animate(event);
      setHeight(0);
    };

    const subscriptions =
      Platform.OS === "ios"
        ? [
            // iOS re-sends willShow when the keyboard resizes while up
            // (keyboard type switch, suggestion bar), so heights stay live.
            Keyboard.addListener("keyboardWillChangeFrame", onShow),
            Keyboard.addListener("keyboardWillHide", onHide),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", onShow),
            Keyboard.addListener("keyboardDidHide", onHide),
          ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [enabled]);

  if (!enabled || height === 0) return 0;
  return Platform.OS === "ios" ? Math.max(0, height - bottomInset) : height;
}
