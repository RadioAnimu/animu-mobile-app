import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DICT } from "../../i18n";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
  onPress: () => void;
}

/** Home-screen entry point into the lyrics overlay. */
export function LyricsButton({ onPress }: Props) {
  const { settings } = useUserSettings();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={DICT[settings.selectedLanguage].LYRICS}
      accessibilityRole="button"
    >
      <Ionicons
        name="musical-notes"
        size={THEME.ICON.MD}
        color={THEME.COLORS.BRAND}
      />
      <Text style={styles.label}>{DICT[settings.selectedLanguage].LYRICS}</Text>
    </TouchableOpacity>
  );
}
