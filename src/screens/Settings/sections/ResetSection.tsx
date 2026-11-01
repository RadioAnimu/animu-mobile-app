import { useState } from "react";
import { View } from "react-native";

import { DestructiveAction } from "@/components/DestructiveAction";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Settings/styles";
import { haptics } from "@/utils/haptics";
import { confirmDestructive } from "@/utils/confirm";

/** The "reset settings" action, styled as the destructive step it is. */
export function ResetSection() {
  const { resetSettings } = useUserSettings();
  const { toast } = useAlert();
  const dict = useDict();
  const [resetting, setResetting] = useState(false);

  const confirmReset = () => {
    confirmDestructive({
      title: dict.SETTINGS_RESET_CONFIRM_TITLE,
      message: dict.SETTINGS_RESET_CONFIRM_MSG,
      cancel: dict.ACCOUNT_CANCEL,
      confirm: dict.SETTINGS_RESET_CONFIRM,
      onConfirm: () => {
        haptics.warning();
        void (async () => {
          setResetting(true);
          try {
            if (await resetSettings()) {
              toast(dict.SETTINGS_RESET_TOAST);
            } else {
              haptics.error();
              toast(dict.SETTINGS_SAVE_FAILED, "error");
            }
          } finally {
            setResetting(false);
          }
        })();
      },
    });
  };

  return (
    <>
      {/* No heading: the red button already says "Reset settings". */}
      <View style={styles.groupSpaced}>
        <DestructiveAction
          icon="restart-alt"
          label={dict.SETTINGS_RESET_ROW}
          description={dict.SETTINGS_RESET_DESC}
          busy={resetting}
          onPress={confirmReset}
        />
      </View>
    </>
  );
}
