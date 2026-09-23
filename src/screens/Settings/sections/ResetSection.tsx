import { useState } from "react";
import { Alert } from "react-native";

import { DestructiveAction } from "@/components/DestructiveAction";
import { SectionTitle } from "@/components/SectionTitle";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { haptics } from "@/utils/haptics";

/** Advanced section holding the destructive "reset everything" action. */
export function ResetSection() {
  const { resetSettings } = useUserSettings();
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
                await resetSettings();
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
      <SectionTitle title={dict.SETTINGS_ADVANCED_TITLE} icon="settings" />
      <DestructiveAction
        icon="restart-alt"
        label={dict.SETTINGS_RESET_ROW}
        busy={resetting}
        onPress={confirmReset}
      />
    </>
  );
}
