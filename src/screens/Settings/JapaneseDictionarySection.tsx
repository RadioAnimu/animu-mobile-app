import React, { useCallback } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  japaneseDictionaryManager,
  useJapaneseDictionary,
} from "../../core/japanese";
import { styles } from "./styles";

// ─── Offline Japanese dictionary (Settings) ───
//
// Opt-in ~17 MB download that unlocks kanji readings for the lyrics
// labels: full romaji plus a hiragana (furigana-style) mode aimed at
// learners. Download state lives in the dictionary store, so the lyrics
// sheet reacts to it without any wiring through here.

export function JapaneseDictionarySection() {
  const { settings } = useUserSettings();
  const dictionary = useJapaneseDictionary();
  const dict = DICT[settings.selectedLanguage];

  const statusText = (() => {
    switch (dictionary.download) {
      case "none":
        return dict.SETTINGS_JP_DICTIONARY_DOWNLOAD;
      case "downloading":
        return `${Math.round(dictionary.progress * 100)}%`;
      case "ready":
        return dict.SETTINGS_JP_DICTIONARY_READY;
      case "error":
        return dict.SETTINGS_JP_DICTIONARY_ERROR;
    }
  })();

  const handlePress = useCallback(() => {
    if (dictionary.download === "none" || dictionary.download === "error") {
      void japaneseDictionaryManager.download();
    }
  }, [dictionary.download]);

  const handleDelete = useCallback(() => {
    void japaneseDictionaryManager.remove();
  }, []);

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={dictionary.download === "downloading"}
        style={styles.row}
      >
        <Text style={styles.rowLabel}>
          {dict.SETTINGS_JP_DICTIONARY_ROW}
        </Text>
        <View style={styles.rowValue}>
          <Text
            style={[
              styles.rowValueText,
              dictionary.download === "ready" && { color: THEME.COLORS.BRAND },
              dictionary.download === "downloading" && {
                color: THEME.COLORS.TEXT_DIM,
              },
            ]}
          >
            {statusText}
          </Text>
          {dictionary.download === "ready" ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={dict.SETTINGS_JP_DICTIONARY_DELETE}
              onPress={handleDelete}
              style={styles.iconButton}
            >
              <MaterialIcons
                name="delete-outline"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_DIM}
              />
            </TouchableOpacity>
          ) : (
            <MaterialIcons
              name="chevron-right"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          )}
        </View>
      </TouchableOpacity>

      {dictionary.download === "downloading" && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(4, Math.round(dictionary.progress * 100))}%` },
            ]}
          />
        </View>
      )}

      <Text style={styles.hintText}>{dict.SETTINGS_JP_DICTIONARY_HINT}</Text>
    </View>
  );
}
