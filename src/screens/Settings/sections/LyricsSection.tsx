import { Alert, View } from "react-native";

import { SectionTitle } from "@/components/SectionTitle";
import { japaneseDictionary, type JapaneseDictionarySnapshot } from "@/core/japanese";
import { useDict } from "@/hooks/useDict";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";
import type { Dict } from "@/i18n";
import { ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { dictionarySize } from "@/screens/Settings/sections/dictionary-size";
import { haptics } from "@/utils/haptics";

function statusOf(dictionary: JapaneseDictionarySnapshot, dict: Dict): string {
  switch (dictionary.install) {
    case "downloading":
      return `${Math.round(dictionary.progress * 100)}%`;
    case "installed":
      return dict.SETTINGS_JP_DICTIONARY_INSTALLED;
    case "error":
      return dictionary.failure === "space" ? dict.SETTINGS_JP_DICTIONARY_NO_SPACE : dict.SETTINGS_JP_DICTIONARY_ERROR;
    default:
      return dict.SETTINGS_JP_DICTIONARY_DOWNLOAD;
  }
}

/**
 * The Japanese dictionary (kanji readings for lyrics): download it, follow
 * or stop its download, remove it. The pronunciation itself is chosen in
 * the lyrics, where it shows.
 */
export function LyricsSection() {
  const dict = useDict();
  const dictionary = useJapaneseDictionary();

  const confirm = (title: string, message: string, keep: string, act: string, run: () => Promise<void>) => {
    haptics.warning();
    Alert.alert(title, message, [
      { text: keep, style: "cancel" },
      {
        text: act,
        style: "destructive",
        onPress: () => {
          run().catch(() => {});
        },
      },
    ]);
  };

  const onPress = () => {
    if (dictionary.install === "downloading") {
      confirm(
        dict.SETTINGS_JP_DICTIONARY_STOP_TITLE,
        dict.SETTINGS_JP_DICTIONARY_STOP_MSG,
        dict.SETTINGS_JP_DICTIONARY_KEEP,
        dict.SETTINGS_JP_DICTIONARY_STOP,
        () => japaneseDictionary.cancel(),
      );
      return;
    }
    if (dictionary.install === "installed") {
      confirm(
        dict.SETTINGS_JP_DICTIONARY_REMOVE_TITLE,
        dict.SETTINGS_JP_DICTIONARY_REMOVE_MSG,
        dict.ACCOUNT_CANCEL,
        dict.SETTINGS_JP_DICTIONARY_REMOVE,
        () => japaneseDictionary.remove(),
      );
      return;
    }
    haptics.tap();
    japaneseDictionary.install().catch(() => {});
  };

  return (
    <>
      <SectionTitle title={dict.SETTINGS_LYRICS_TITLE} icon="lyrics" />
      <View style={styles.group}>
        <ValueRow
          icon="menu-book"
          label={dict.SETTINGS_JP_DICTIONARY_ROW}
          description={`${dict.SETTINGS_JP_DICTIONARY_DESC} · ${dictionarySize(dict)}`}
          value={statusOf(dictionary, dict)}
          onPress={onPress}
        />
      </View>
    </>
  );
}
