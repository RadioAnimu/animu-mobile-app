import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

type SettingEvent = "screenReaderChanged" | "reduceMotionChanged";

/** A live system accessibility setting: read once, then followed. */
export function useAccessibilitySetting(read: () => Promise<boolean>, event: SettingEvent): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    read()
      .then((value) => {
        if (alive) setEnabled(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [read, event]);

  return enabled;
}
