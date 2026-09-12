import { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAlert } from "../../contexts/alert/AlertProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { Sheet } from "../Sheet";
import { styles } from "./styles";

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Busy = "upload" | "reset" | null;

/** Tap-avatar options: upload a new photo or reset to the provider avatar. */
export function AvatarSheet({ visible, onClose }: Props) {
  const { uploadAvatar, resetAvatar } = useAuth();
  const { settings } = useUserSettings();
  const { toast, error: showError } = useAlert();
  const dict = DICT[settings.selectedLanguage];

  const [busy, setBusy] = useState<Busy>(null);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const handleUpload = async () => {
    if (busy) return;
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError(dict.ACCOUNT_IMAGE_PERMISSION);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled) return;

    setBusy("upload");
    try {
      await uploadAvatar(new File(result.assets[0].uri));
      toast(dict.ACCOUNT_AVATAR_UPDATED);
      onClose();
    } catch {
      showError(dict.ACCOUNT_ACTION_FAILED);
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    if (busy) return;
    setBusy("reset");
    try {
      await resetAvatar();
      toast(dict.ACCOUNT_AVATAR_RESET_DONE);
      onClose();
    } catch {
      showError(dict.ACCOUNT_ACTION_FAILED);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      closable={!busy}
      maxHeight="60%"
    >
      <View style={styles.content}>
        <Text style={styles.title}>{dict.ACCOUNT_AVATAR}</Text>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={!!busy}
          onPress={handleUpload}
          style={styles.option}
        >
          <MaterialIcons
            name="photo-camera"
            size={THEME.ICON.LG}
            color={THEME.COLORS.TEXT}
          />
          <Text style={styles.optionText}>{dict.ACCOUNT_AVATAR_UPLOAD}</Text>
          {busy === "upload" && (
            <ActivityIndicator color={THEME.COLORS.TEXT} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={!!busy}
          onPress={handleReset}
          style={styles.option}
        >
          <MaterialIcons
            name="restore"
            size={THEME.ICON.LG}
            color={THEME.COLORS.TEXT}
          />
          <Text style={styles.optionText}>{dict.ACCOUNT_AVATAR_RESET}</Text>
          {busy === "reset" && <ActivityIndicator color={THEME.COLORS.TEXT} />}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          disabled={!!busy}
          onPress={onClose}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>{dict.ACCOUNT_CANCEL}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}
