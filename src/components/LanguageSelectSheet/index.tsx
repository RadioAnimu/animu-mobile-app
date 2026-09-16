import { useCallback, useMemo, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  type ListRenderItem,
} from "react-native";
import { DICT, LANGS_KEY_VALUE_PAIRS } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { styles } from "./styles";
import { Sheet } from "../Sheet";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function LanguageSelectSheet({ visible, onClose }: Props) {
  const { settings, updateSettings } = useUserSettings();
  const [query, setQuery] = useState("");

  const languages = useMemo(
    () =>
      Object.keys(LANGS_KEY_VALUE_PAIRS).map((key) => ({
        key,
        name: LANGS_KEY_VALUE_PAIRS[key as keyof typeof LANGS_KEY_VALUE_PAIRS],
      })),
    [],
  );

  const filtered = useMemo(
    () =>
      languages.filter(({ key, name }) => {
        const haystack = normalize(`${name} ${key}`);
        return haystack.includes(normalize(query));
      }),
    [languages, query],
  );

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  const onSelect = useCallback(
    (key: keyof typeof LANGS_KEY_VALUE_PAIRS) => {
      updateSettings({ selectedLanguage: key });
      handleClose();
    },
    [updateSettings, handleClose],
  );

  const renderItem: ListRenderItem<(typeof filtered)[number]> = useCallback(
    ({ item }) => {
      const selected = settings.selectedLanguage === item.key;
      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected }}
          activeOpacity={0.7}
          onPress={() => {
            onSelect(item.key as keyof typeof LANGS_KEY_VALUE_PAIRS);
          }}
          style={styles.langRow}
        >
          <Text
            style={[
              styles.langName,
              selected && styles.langNameSelected,
            ]}
          >
            {item.name}
          </Text>
          {selected && (
            <MaterialIcons
              name="check"
              size={THEME.ICON.MD}
              color={THEME.COLORS.BRAND}
            />
          )}
        </TouchableOpacity>
      );
    },
    [settings.selectedLanguage, onSelect],
  );

  return (
    <Sheet visible={visible} onClose={handleClose} withKeyboard maxHeight="75%">
      <Text style={styles.title}>
        {DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_SELECT_TITLE}
      </Text>

      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder={
          DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_SEARCH_PLACEHOLDER
        }
        placeholderTextColor={THEME.COLORS.TEXT_DIM}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <FlatList
        style={styles.list}
        data={filtered}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {DICT[settings.selectedLanguage].SETTINGS_LANGUAGE_NOT_FOUND}
          </Text>
        }
      />
    </Sheet>
  );
}
