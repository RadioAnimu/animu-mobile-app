import { Icon } from "@/components/Icon";
import { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { styles } from "@/screens/MakeRequest/styles";

/**
 * Search field. One in-field icon slot: a decorative magnifier while the
 * field is empty (tap just focuses), swapping to a clear button once there
 * is text. Searching itself happens on the keyboard's search key only —
 * `onSubmitEditing`.
 */
export function SearchBar({
  inputRef,
  dict,
  query,
  onChangeText,
  onSubmit,
  onClear,
  onFocusChange,
}: Readonly<{
  inputRef: React.RefObject<TextInput | null>;
  dict: Dict;
  query: string;
  onChangeText: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocusChange: (focused: boolean) => void;
}>) {
  const [focused, setFocused] = useState(false);
  const hasQuery = query !== "";

  return (
    <View style={styles.inputContainer}>
      <View style={styles.searchField}>
        <TextInput
          ref={inputRef}
          style={[styles.input, focused && styles.inputFocused]}
          placeholder={dict.REQUEST_SEARCH_PLACEHOLDER}
          // Dimmer than typed text, like every other field's placeholder.
          placeholderTextColor={THEME.COLORS.TEXT_DIM}
          accessibilityLabel={dict.REQUEST_SEARCH_PLACEHOLDER}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => {
            setFocused(true);
            onFocusChange(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange(false);
          }}
          // Titles are proper nouns/romaji — spellcheck mangles them.
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // Grays the Enter key out while the field is empty (iOS).
          enablesReturnKeyAutomatically
          // Enter runs the search and drops the keyboard out of the way so
          // the results are visible immediately.
          submitBehavior="blurAndSubmit"
        />
        {hasQuery ? (
          <TouchableOpacity
            activeOpacity={THEME.OPACITY.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_CLEAR_SEARCH}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={onClear}
            style={styles.fieldIcon}
          >
            <Icon
              name="cancel"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={THEME.OPACITY.PRESSED}
            accessibilityRole="none"
            accessible={false}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={() => inputRef.current?.focus()}
            style={styles.fieldIcon}
          >
            <Icon
              name="search"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
