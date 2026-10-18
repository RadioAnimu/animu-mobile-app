import { useCallback } from "react";

import type { UserSettings } from "@/@types/user-settings";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

/**
 * `updateSettings` for the settings UI: when the change could not be
 * persisted the provider keeps the previous value, and this tells the
 * user instead of leaving a toggle that silently didn't move.
 */
export function useSaveSettings(): (
  settings: Partial<UserSettings>,
) => Promise<boolean> {
  const { updateSettings } = useUserSettings();
  const { toast } = useAlert();
  const dict = useDict();

  return useCallback(
    async (settings) => {
      const saved = await updateSettings(settings);
      if (!saved) {
        haptics.error();
        toast(dict.SETTINGS_SAVE_FAILED, "error");
      }
      return saved;
    },
    [updateSettings, toast, dict],
  );
}
