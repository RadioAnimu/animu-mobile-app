import { Alert } from "react-native";

import { useAlert } from "@/contexts/alert/AlertProvider";
import { useOta } from "@/contexts/ota/OtaProvider";
import { useDict } from "@/hooks/useDict";
import { Dict } from "@/i18n";

/** Human-readable label for each OTA status. */
const statusLabel = (status: string, dict: Dict) => {
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

/** The "check for updates" flow: status label, manual check and restart. */
export function useOtaUpdate() {
  const { status, checkNow, applyNow } = useOta();
  const { toast } = useAlert();
  const dict = useDict();

  const value = () => statusLabel(status, dict);

  const confirmRestart = () => {
    Alert.alert(
      dict.SETTINGS_UPDATES_RESTART_TITLE,
      dict.SETTINGS_UPDATES_RESTART_MSG,
      [
        { text: dict.ACCOUNT_CANCEL, style: "cancel" },
        { text: dict.SETTINGS_UPDATES_RESTART_CONFIRM, onPress: applyNow },
      ],
    );
  };

  const check = async () => {
    const outcome = await checkNow();
    if (outcome === "up-to-date") toast(dict.SETTINGS_UPDATES_UP_TO_DATE);
    else if (outcome === "downloaded") toast(dict.SETTINGS_UPDATES_DOWNLOADED);
    else if (outcome === "ready") confirmRestart();
    else if (outcome === "error") toast(dict.SETTINGS_UPDATES_ERROR);
  };

  return { value, check };
}
