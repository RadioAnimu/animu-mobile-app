import { useMemo } from "react";
import { Platform, View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { LANGS_KEY_VALUE_PAIRS } from "@/i18n";
import { cleanLabel } from "@/screens/Settings/labels";
import { Divider, InfoRow, SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

/**
 * Playback behavior (visualizer + live song info) and the app-wide
 * preferences (language, haptics, voice assistant), combined so a single
 * card covers each domain instead of one card per toggle.
 */
export function BehaviorSection() {
  const { settings, updateSettings } = useUserSettings();
  const dict = useDict();

  // iOS cannot tap a live AVPlayer stream, so the visualizer is Android-only
  // for now. The row stays visible but locked with a "coming soon" note.
  const visualizerUnavailable = Platform.OS === "ios";

  const languageOptions = useMemo<
    SelectOption<keyof typeof LANGS_KEY_VALUE_PAIRS>[]
  >(
    () =>
      (
        Object.keys(LANGS_KEY_VALUE_PAIRS) as (keyof typeof LANGS_KEY_VALUE_PAIRS)[]
      ).map((key) => ({ key, label: LANGS_KEY_VALUE_PAIRS[key] })),
    [],
  );

  return (
    <>
      <SectionTitle title={dict.SETTINGS_PLAYBACK_TITLE} icon="graphic-eq" />
      <View style={styles.group}>
        <SettingsRow
          icon="graphic-eq"
          label={cleanLabel(dict.SETTINGS_VISUALIZER_SWITCH)}
          description={
            visualizerUnavailable
              ? dict.SETTINGS_VISUALIZER_COMING_SOON
              : dict.SETTINGS_VISUALIZER_DESC
          }
          value={!visualizerUnavailable && settings.visualizerHz > 0}
          disabled={visualizerUnavailable}
          onToggle={() =>
            updateSettings({ visualizerHz: settings.visualizerHz > 0 ? 0 : 1 })
          }
        />
        <Divider />
        <SettingsRow
          icon="wifi"
          label={cleanLabel(dict.SETTINGS_LIVE_UPDATES_SWITCH)}
          description={dict.SETTINGS_LIVE_UPDATES_DESC}
          value={settings.liveUpdatesInBackground}
          onToggle={() =>
            updateSettings({
              liveUpdatesInBackground: !settings.liveUpdatesInBackground,
            })
          }
        />
      </View>

      <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="tune" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_LANGUAGE_ROW}
          icon="language"
          options={languageOptions}
          value={settings.selectedLanguage}
          onChange={(key) => updateSettings({ selectedLanguage: key })}
        />
        <Divider />
        <SettingsRow
          icon="vibration"
          label={cleanLabel(dict.SETTINGS_HAPTICS_SWITCH)}
          description={dict.SETTINGS_HAPTICS_DESC}
          value={settings.hapticsEnabled}
          onToggle={() =>
            updateSettings({ hapticsEnabled: !settings.hapticsEnabled })
          }
        />
        <Divider />
        <InfoRow
          icon="record-voice-over"
          label={dict.SETTINGS_ASSISTANT_TITLE}
          description={dict.SETTINGS_ASSISTANT_HINT}
        />
      </View>
    </>
  );
}
