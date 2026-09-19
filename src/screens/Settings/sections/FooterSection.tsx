import { useState } from "react";
import * as Linking from "expo-linking";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { author } from "@app/package.json";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Settings/styles";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

/** Dev portfolio — the credits hyperlink target. */
const PORTFOLIO_URL = "https://rmotafreitas.dev";

/** Quiet reset action plus the version/credits footer. */
export function FooterSection() {
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
      {/* Reset is its own quiet action at the very bottom — not a fake
          "About" section (there's nothing else About-ish to group it with).
          The version footer follows. */}
      <View style={styles.group}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: resetting || undefined }}
          activeOpacity={0.7}
          onPress={confirmReset}
          disabled={resetting}
          style={[styles.resetRow, resetting && styles.resetRowDisabled]}
        >
          <Text style={styles.resetLabel}>{dict.SETTINGS_RESET_ROW}</Text>
          {resetting && (
            <ActivityIndicator size="small" color={THEME.COLORS.ERROR} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityRole="link"
          activeOpacity={0.7}
          onPress={() => {
            void Linking.openURL(PORTFOLIO_URL).catch((error) =>
              console.warn("[Links] openURL failed:", error),
            );
          }}
        >
          <Text style={styles.footerText}>
            {dict.VERSION_TEXT}{" "}
            <Text style={styles.footerAuthor}>@{author}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
