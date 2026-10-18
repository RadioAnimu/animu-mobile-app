import { useMemo } from "react";
import { Platform, View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { LANGS_KEY_VALUE_PAIRS } from "@/i18n";
import { RowDivider } from "@/components/ListRow";
import { InfoRow, SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

/**
 * Playback behavior (visualizer) and the app-wide preferences (language,
 * haptics, voice assistant), combined so a single card covers each domain
 * instead of one card per toggle.
 */
export function BehaviorSection() {
  const { settings, updateSettings } = useUserSettings();
  const dict = useDict();

  // iOS cannot tap a live AVPlayer stream, so the visualizer is Android-only.
  // The row is omitted entirely on iOS rather than shipped as a disabled
  // "coming soon" placeholder (App Review flags placeholder features, 2.1(a)).
  // The live-song-info toggle was removed: a radio client is always kept up
  // to date now (the realtime connection is managed automatically), so with
  // the visualizer gone too, the whole Playback group is Android-only.
  const isIOS = Platform.OS === "ios";

  const languageOptions = useMemo<
    SelectOption<keyof typeof LANGS_KEY_VALUE_PAIRS>[]
  >(
    () =>
      (
        Object.keys(
          LANGS_KEY_VALUE_PAIRS,
        ) as (keyof typeof LANGS_KEY_VALUE_PAIRS)[]
      ).map((key) => ({ key, label: LANGS_KEY_VALUE_PAIRS[key] })),
    [],
  );

  return (
    <>
      {!isIOS && (
        <>
          <SectionTitle
            title={dict.SETTINGS_PLAYBACK_TITLE}
            icon="graphic-eq"
          />
          <View style={styles.group}>
            <SettingsRow
              icon="graphic-eq"
              label={dict.SETTINGS_VISUALIZER_SWITCH}
              description={dict.SETTINGS_VISUALIZER_DESC}
              value={settings.visualizerHz > 0}
              onToggle={() =>
                updateSettings({
                  visualizerHz: settings.visualizerHz > 0 ? 0 : 1,
                })
              }
            />
          </View>
        </>
      )}

      <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="tune" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_LANGUAGE_ROW}
          icon="language"
          options={languageOptions}
          value={settings.selectedLanguage}
          onChange={(key) => updateSettings({ selectedLanguage: key })}
        />
        <RowDivider />
        <SettingsRow
          icon="vibration"
          label={dict.SETTINGS_HAPTICS_SWITCH}
          value={settings.hapticsEnabled}
          onToggle={() =>
            updateSettings({ hapticsEnabled: !settings.hapticsEnabled })
          }
        />
        <RowDivider />
        <InfoRow
          icon="record-voice-over"
          label={dict.SETTINGS_ASSISTANT_TITLE}
          description={
            isIOS
              ? dict.SETTINGS_ASSISTANT_HINT_IOS
              : dict.SETTINGS_ASSISTANT_HINT_ANDROID
          }
        />
      </View>
    </>
  );
}
