import { Alert, View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { ValueRow } from "@/screens/Settings/rows";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useDict } from "@/hooks/useDict";
import { useOta } from "@/contexts/ota/OtaProvider";
import { isOtaSupported } from "@/core/ota";
import { styles } from "@/screens/Settings/styles";

/** Over-the-air update check (hidden when the platform can't apply them). */
export function UpdatesSection() {
  const { status, checkNow, applyNow } = useOta();
  const { toast } = useAlert();
  const dict = useDict();

  if (!isOtaSupported()) return null;

  const value = () => {
    switch (status) {
      case "checking":
        return dict.SETTINGS_UPDATES_CHECKING;
      case "downloading":
        return dict.SETTINGS_UPDATES_DOWNLOADING;
      case "ready":
        return dict.SETTINGS_UPDATES_READY;
      case "available":
        return dict.SETTINGS_UPDATES_ROW;
      case "up-to-date":
        return dict.SETTINGS_UPDATES_UP_TO_DATE;
      case "error":
        return dict.SETTINGS_UPDATES_ERROR;
      default:
        return dict.SETTINGS_UPDATES_ROW;
    }
  };

  const confirmRestart = () => {
    Alert.alert(
      dict.SETTINGS_UPDATES_RESTART_TITLE,
      dict.SETTINGS_UPDATES_RESTART_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        {
          text: dict.SETTINGS_UPDATES_RESTART_CONFIRM,
          onPress: applyNow,
        },
      ],
    );
  };

  const check = async () => {
    const outcome = await checkNow();
    if (outcome === "up-to-date") {
      toast(dict.SETTINGS_UPDATES_UP_TO_DATE);
    } else if (outcome === "downloaded") {
      toast(dict.SETTINGS_UPDATES_DOWNLOADED);
    } else if (outcome === "ready") {
      confirmRestart();
    } else if (outcome === "error") {
      toast(dict.SETTINGS_UPDATES_ERROR);
    }
  };

  return (
    <>
      <SectionTitle title={dict.SETTINGS_UPDATES_TITLE} icon="system-update" />
      <View style={styles.group}>
        <ValueRow
          label={dict.SETTINGS_UPDATES_ROW}
          description={dict.SETTINGS_UPDATES_DESC}
          value={value()}
          onPress={() => void check()}
        />
      </View>
    </>
  );
}
