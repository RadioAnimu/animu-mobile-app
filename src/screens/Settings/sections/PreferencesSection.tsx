import { useMemo } from "react";
import { View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import { LANGUAGE_LABELS } from "@/constants/languages";
import { RowDivider } from "@/components/ListRow";
import { SettingsRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";

/** App-wide preferences: language and touch vibration. */
export function PreferencesSection() {
  const { settings } = useUserSettings();
  const save = useSaveSettings();
  const dict = useDict();

  const languageOptions = useMemo<
    SelectOption<keyof typeof LANGUAGE_LABELS>[]
  >(
    () =>
      (
        Object.keys(
          LANGUAGE_LABELS,
        ) as (keyof typeof LANGUAGE_LABELS)[]
      ).map((key) => ({ key, label: LANGUAGE_LABELS[key] })),
    [],
  );

  return (
    <>
      <SectionTitle title={dict.SETTINGS_GENERAL_TITLE} icon="tune" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_LANGUAGE_ROW}
          icon="language"
          options={languageOptions}
          value={settings.selectedLanguage}
          onChange={(key) => save({ selectedLanguage: key })}
        />
        <RowDivider />
        <SettingsRow
          icon="vibration"
          label={dict.SETTINGS_HAPTICS_SWITCH}
          value={settings.hapticsEnabled}
          onToggle={() => void save({ hapticsEnabled: !settings.hapticsEnabled })}
        />
      </View>
    </>
  );
}
