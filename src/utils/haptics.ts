import * as Haptics from "expo-haptics";

import { userSettingsService } from "@/core/services/user-settings.service";

/**
 * Fire-and-forget haptics, gated by the user's `hapticsEnabled` setting.
 *
 * Every call swallows its promise: an unsupported device, a disabled OS
 * setting, or web must never surface an error or block the action.
 */
function run(feedback: () => Promise<unknown>): void {
  if (!userSettingsService.getCurrentSettings().hapticsEnabled) return;
  void feedback().catch(() => {});
}

export const haptics = {
  /** Light tick for a selection or toggle. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Light impact for a primary tap (play/pause, open). */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium impact for a weightier action. */
  press: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Success notification (request sent, sign-in). */
  success: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  /** Error notification. */
  error: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
  /** Warning notification (destructive confirmation). */
  warning: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
};
