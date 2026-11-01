import { AccessibilityInfo } from "react-native";
import { useAccessibilitySetting } from "@/hooks/useAccessibilitySetting";

const read = () => AccessibilityInfo.isReduceMotionEnabled();

/**
 * Live "Reduce Motion" (iOS) / "Remove animations" (Android) preference.
 *
 * When on, spatial movement (slides, rises, bobbing, scale pops) gives way to
 * plain fades or instant state changes; feedback that carries meaning — a
 * spinner, a progress bar — keeps running.
 */
export function useReducedMotion(): boolean {
  return useAccessibilitySetting(read, "reduceMotionChanged");
}
