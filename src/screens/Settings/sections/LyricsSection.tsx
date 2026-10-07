import { useMemo } from "react";
import { Alert, View } from "react-native";

import { RowDivider } from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { Select, type SelectOption } from "@/components/Select";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { DICTIONARY_BYTES, japaneseDictionary } from "@/core/japanese";
import type { PronunciationMode } from "@/core/lyrics/pronunciation";
import { useDict } from "@/hooks/useDict";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";
import { ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { formatBytes } from "@/utils/format";
import { haptics } from "@/utils/haptics";

/** Lyrics preferences: the Japanese pronunciation label and its dictionary. */
export function LyricsSection() {
  const { settings, updateSettings } = useUserSettings();
  const dict = useDict();
  const dictionary = useJapaneseDictionary();

  const options = useMemo<SelectOption<PronunciationMode>[]>(
    () => [
      { key: "romaji", label: dict.LYRICS_PRONUNCIATION_ROMAJI },
      { key: "hiragana", label: dict.LYRICS_PRONUNCIATION_HIRAGANA },
      { key: "off", label: dict.LYRICS_PRONUNCIATION_OFF },
    ],
    [dict],
  );

  const status = {
    none: dict.SETTINGS_JP_DICTIONARY_DOWNLOAD,
    downloading: `${Math.round(dictionary.progress * 100)}%`,
    installed: dict.SETTINGS_JP_DICTIONARY_INSTALLED,
    error: dict.SETTINGS_JP_DICTIONARY_ERROR,
  }[dictionary.install];

  const onDictionary = () => {
    if (dictionary.install === "downloading") return;
    if (dictionary.install !== "installed") {
      haptics.tap();
      void japaneseDictionary.install();
      return;
    }
    haptics.warning();
    Alert.alert(dict.SETTINGS_JP_DICTIONARY_REMOVE_TITLE, dict.SETTINGS_JP_DICTIONARY_REMOVE_MSG, [
      { text: dict.ACCOUNT_CANCEL, style: "cancel" },
      {
        text: dict.SETTINGS_JP_DICTIONARY_REMOVE,
        style: "destructive",
        onPress: () => {
          void japaneseDictionary.remove();
        },
      },
    ]);
  };

  return (
    <>
      <SectionTitle title={dict.SETTINGS_LYRICS_TITLE} icon="lyrics" />
      <View style={styles.group}>
        <Select
          label={dict.SETTINGS_LYRICS_PRONUNCIATION_ROW}
          icon="translate"
          options={options}
          value={settings.lyricsPronunciation}
          onChange={(key) => updateSettings({ lyricsPronunciation: key })}
        />
        <RowDivider />
        <ValueRow
          icon="menu-book"
          label={dict.SETTINGS_JP_DICTIONARY_ROW}
          description={`${dict.SETTINGS_JP_DICTIONARY_DESC} · ${formatBytes(DICTIONARY_BYTES)}`}
          value={status}
          onPress={onDictionary}
        />
      </View>
    </>
  );
}
