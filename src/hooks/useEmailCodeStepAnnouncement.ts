import { useEffect, useRef } from "react";
import { AccessibilityInfo } from "react-native";

import { useDict } from "@/hooks/useDict";
import type { EmailCodeStep } from "@/hooks/useEmailCodeFlow";

/**
 * Tells a screen reader which step of Animu Connect just appeared. The step
 * change swaps the form under the user, who would otherwise hear nothing.
 *
 * Announces once per actual step change: never on first render, and never on
 * a resend or a countdown tick (the step doesn't change). It only speaks, so
 * accessibility focus stays on the active input. `enabled` mutes it when the
 * flow is winding down (e.g. the verified form resetting as the screen
 * closes); the change is still consumed so it can't fire late.
 */
export function useEmailCodeStepAnnouncement(
  step: EmailCodeStep,
  enabled = true,
): void {
  const dict = useDict();
  const previous = useRef(step);

  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    if (!enabled) return;
    AccessibilityInfo.announceForAccessibility(
      step === "code"
        ? dict.A11Y_EMAIL_CODE_STEP_CODE
        : dict.A11Y_EMAIL_CODE_STEP_EMAIL,
    );
  }, [step, enabled, dict]);
}
