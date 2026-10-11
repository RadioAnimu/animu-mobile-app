import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Live VoiceOver / TalkBack state. */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (alive) setEnabled(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
