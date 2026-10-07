import { Text, TouchableOpacity, View } from "react-native";
import { japaneseDictionary, type JapaneseDictionarySnapshot } from "@/core/japanese";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Lyrics/styles";
import { dictionarySize } from "@/screens/Settings/sections/dictionary-size";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

/** Offers the Japanese dictionary where the pronunciation labels would be. */
export function DictionaryPrompt({ dictionary }: Readonly<{ dictionary: JapaneseDictionarySnapshot }>) {
  const dict = useDict();
  const downloading = dictionary.install === "downloading";

  return (
    <View style={styles.prompt} accessibilityLiveRegion="polite">
      <Text style={styles.promptTitle}>{dict.LYRICS_DICTIONARY_PROMPT_TITLE}</Text>
      <Text style={styles.promptText}>
        {dictionary.install === "error" ? dict.SETTINGS_JP_DICTIONARY_ERROR : dict.LYRICS_DICTIONARY_PROMPT}
      </Text>
      <View style={styles.promptActions}>
        <Text style={styles.promptText}>
          {downloading ? `${Math.round(dictionary.progress * 100)}%` : dictionarySize(dict)}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: downloading, busy: downloading }}
          activeOpacity={THEME.OPACITY.PRESSED}
          disabled={downloading}
          onPress={() => {
            haptics.tap();
            japaneseDictionary.install().catch(() => {});
          }}
          style={[styles.pill, styles.promptButton, downloading && styles.promptButtonBusy]}
        >
          <Text style={styles.pillText}>{dict.LYRICS_DICTIONARY_DOWNLOAD}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
