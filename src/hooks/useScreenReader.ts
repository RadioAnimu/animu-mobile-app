import { AccessibilityInfo } from "react-native";
import { useAccessibilitySetting } from "@/hooks/useAccessibilitySetting";

const read = () => AccessibilityInfo.isScreenReaderEnabled();

/** Live VoiceOver / TalkBack state. */
export function useScreenReader(): boolean {
  return useAccessibilitySetting(read, "screenReaderChanged");
}
