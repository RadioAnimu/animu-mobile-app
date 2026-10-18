import { useState } from "react";
import { Alert, View } from "react-native";

import { DestructiveAction } from "@/components/DestructiveAction";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Settings/styles";
import { haptics } from "@/utils/haptics";

/** The "reset settings" action, styled as the destructive step it is. */
export function ResetSection() {
  const { resetSettings } = useUserSettings();
  const { toast } = useAlert();
  const dict = useDict();
  const [resetting, setResetting] = useState(false);

  const confirmReset = () => {
    Alert.alert(
      dict.SETTINGS_RESET_CONFIRM_TITLE,
      dict.SETTINGS_RESET_CONFIRM_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.SETTINGS_RESET_CONFIRM,
          style: "destructive",
          onPress: () => {
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
        },
      ],
    );
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
