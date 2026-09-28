import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

import { layoutEase } from "@/utils/layout-animation";

/**
 * Bottom padding equal to the software keyboard height.
 *
 * We don't use RN's `KeyboardAvoidingView`: on Android edge-to-edge (SDK 57,
 * targetSdk 36) it handles `keyboardDidHide` through `_onKeyboardChange`, so it
 * recomputes padding from the hide event's `screenY` — which is reported wrong
 * in edge-to-edge — and leaves a transparent gap behind after the keyboard
 * closes (the sheet stays "floating"). Here the hide event is always ignored
 * and the padding is reset to 0.
 *
 * On iOS the `willShow`/`willHide` pair tracks the keyboard animation; on
 * Android the `didShow`/`didHide` pair avoids the same edge-to-edge
 * `screenY` problem. Screens that already handle iOS through
 * `automaticallyAdjustKeyboardInsets` should enable this on Android only.
 */
export function useKeyboardPadding(enabled: boolean): number {
  const [padding, setPadding] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPadding(0);
      return;
    }

    const animate = () => layoutEase(200);

    const subscriptions = [
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        (event) => {
          animate();
          setPadding(event.endCoordinates.height);
        },
      ),
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        () => {
          animate();
          setPadding(0);
        },
      ),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [enabled]);

  return enabled ? padding : 0;
}
