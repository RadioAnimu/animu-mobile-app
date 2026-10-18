import { Alert, View } from "react-native";

import { RowDivider } from "@/components/ListRow";
import { SectionTitle } from "@/components/SectionTitle";
import { japaneseDictionary, type JapaneseDictionarySnapshot } from "@/core/japanese";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { useJapaneseDictionary } from "@/hooks/useJapaneseDictionary";
import { useSaveSettings } from "@/hooks/useSaveSettings";
import type { Dict } from "@/i18n";
import { SettingsRow, ValueRow } from "@/screens/Settings/rows";
import { styles } from "@/screens/Settings/styles";
import { dictionarySize, dictionaryStoredSize } from "@/screens/Settings/sections/dictionary-size";
import { haptics } from "@/utils/haptics";

interface DictionaryCopy {
  /** Status line under the description: the outcome (installed, failed,
      no space) with the size that matters in that state. */
  status: string;
  /** What tapping the row does — the row's trailing value. */
  action: string;
  /** Download progress for screen readers while one runs. */
  progress?: string;
}

function copyOf(dictionary: JapaneseDictionarySnapshot, dict: Dict): DictionaryCopy {
  switch (dictionary.install) {
    case "downloading": {
      const progress = `${Math.round(dictionary.progress * 100)}%`;
      return {
        status: dictionarySize(dict),
        action: `${progress} · ${dict.SETTINGS_JP_DICTIONARY_CANCEL}`,
        progress,
      };
    }
    case "installed":
      return {
        status: `${dict.SETTINGS_JP_DICTIONARY_INSTALLED} · ${dictionaryStoredSize(dict)}`,
        action: dict.SETTINGS_JP_DICTIONARY_REMOVE,
      };
    case "error":
      return {
        status:
          dictionary.failure === "space"
            ? dict.SETTINGS_JP_DICTIONARY_NO_SPACE
            : dict.SETTINGS_JP_DICTIONARY_FAILED,
        action: dict.SETTINGS_JP_DICTIONARY_RETRY,
      };
    default:
      return { status: dictionarySize(dict), action: dict.SETTINGS_JP_DICTIONARY_DOWNLOAD };
  }
}

/**
 * Features still finding their shape: the audio visualizer and the Japanese
 * dictionary (kanji readings for lyrics — download it, follow or stop its
 * download, remove it). The pronunciation itself is chosen in the lyrics,
 * where it shows.
 */
export function ExperimentalSection() {
  const { settings } = useUserSettings();
  const save = useSaveSettings();
  const dict = useDict();
  const dictionary = useJapaneseDictionary();
  const copy = copyOf(dictionary, dict);


  const confirm = (title: string, message: string, act: string, run: () => Promise<void>) => {
    haptics.warning();
    Alert.alert(title, message, [
      { text: dict.ACCOUNT_CANCEL, style: "cancel" },
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
        dict.SETTINGS_JP_DICTIONARY_STOP,
        () => japaneseDictionary.cancel(),
      );
      return;
    }
    if (dictionary.install === "installed") {
      confirm(
        dict.SETTINGS_JP_DICTIONARY_REMOVE_TITLE,
        dict.SETTINGS_JP_DICTIONARY_REMOVE_MSG,
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
      <SectionTitle title={dict.SETTINGS_EXPERIMENTAL_TITLE} icon="science" />
      <View style={styles.group}>
        {/* Both platforms: the player samples the decoded audio natively,
            live streams on iOS included. */}
        <SettingsRow
          icon="graphic-eq"
          label={dict.SETTINGS_VISUALIZER_SWITCH}
          description={dict.SETTINGS_VISUALIZER_DESC}
          value={settings.visualizerHz > 0}
          onToggle={() =>
            void save({ visualizerHz: settings.visualizerHz > 0 ? 0 : 1 })
          }
        />
        <RowDivider />
        <ValueRow
          icon="menu-book"
          label={dict.SETTINGS_JP_DICTIONARY_ROW}
          description={`${dict.SETTINGS_JP_DICTIONARY_DESC}\n${copy.status}`}
          value={copy.action}
          accessibilityValue={copy.progress ? { text: copy.progress } : undefined}
          chevron={false}
          onPress={onPress}
        />
      </View>
    </>
  );
}
