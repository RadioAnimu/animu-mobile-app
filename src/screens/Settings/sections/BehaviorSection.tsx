import { useMemo } from "react";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { LANGS_KEY_VALUE_PAIRS } from "@/i18n";
import { cleanLabel } from "@/screens/Settings/labels";
import { InfoRow, SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

/** Visualizer, background updates, language and the voice-assistant hint. */
export function BehaviorSection() {
  const { settings, updateSettings } = useUserSettings();
  const dict = useDict();

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
      <SectionTitle
        title={dict.SETTINGS_OSCILLOSCOPE_TITLE}
        icon="graphic-eq"
      />
      <View style={styles.group}>
        <SettingsRow
          label={cleanLabel(dict.SETTINGS_VISUALIZER_SWITCH)}
          description={dict.SETTINGS_VISUALIZER_DESC}
          value={settings.visualizerHz > 0}
          onToggle={() =>
            updateSettings({ visualizerHz: settings.visualizerHz > 0 ? 0 : 1 })
          }
        />
      </View>

      <SectionTitle title={dict.SETTINGS_BATTERY_TITLE} icon="wifi" />
      <View style={styles.group}>
        <SettingsRow
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

      <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="language" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_LANGUAGE_ROW}
          options={languageOptions}
          value={settings.selectedLanguage}
          onChange={(key) => updateSettings({ selectedLanguage: key })}
        />
      </View>

      <SectionTitle title={dict.SETTINGS_FEEDBACK_TITLE} icon="vibration" />
      <View style={styles.group}>
        <SettingsRow
          label={cleanLabel(dict.SETTINGS_HAPTICS_SWITCH)}
          description={dict.SETTINGS_HAPTICS_DESC}
          value={settings.hapticsEnabled}
          onToggle={() =>
            updateSettings({ hapticsEnabled: !settings.hapticsEnabled })
          }
        />
      </View>

      <SectionTitle title={dict.SETTINGS_SHORTCUTS_TITLE} icon="mic" />
      <View style={styles.group}>
        <InfoRow
          label={dict.SETTINGS_ASSISTANT_TITLE}
          description={dict.SETTINGS_ASSISTANT_HINT}
          icon="mic"
        />
      </View>
    </>
  );
}
