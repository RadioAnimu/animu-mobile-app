import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useState, type Ref } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";

import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { styles } from "@/components/FormField/styles";

interface Props
  extends Pick<
    TextInputProps,
    | "value"
    | "onChangeText"
    | "placeholder"
    | "multiline"
    | "maxLength"
    | "returnKeyType"
    | "onSubmitEditing"
    | "submitBehavior"
    | "autoCapitalize"
    | "autoCorrect"
    | "enablesReturnKeyAutomatically"
  > {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Appends "(optional)" to the label. */
  optional?: boolean;
  /** Validation message — turns the border red and shows it under the field. */
  error?: string;
  editable?: boolean;
  inputRef?: Ref<TextInput>;
}

/** The counter only appears once the limit is within reach. */
const COUNTER_THRESHOLD = 0.8;

/** Placeholder and clear icon on the white field. */
const PLACEHOLDER_COLOR = "rgba(0, 0, 0, 0.45)";

/**
 * Labelled text field in the app's field recipe, with a focus ring, an inline
 * validation message, a clear button and (when `maxLength` is set) a counter
 * that surfaces near the limit.
 */
export function FormField({
  label,
  value,
  onChangeText,
  optional = false,
  error,
  editable = true,
  inputRef,
  multiline = false,
  maxLength,
  ...inputProps
}: Props) {
  const dict = useDict();
  const [focused, setFocused] = useState(false);

  const showCounter =
    maxLength != null && value.length >= maxLength * COUNTER_THRESHOLD;
  const canClear = !multiline && editable && value.length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabRow}>
        <View
          style={[
            styles.tab,
            focused && styles.tabFocused,
            error != null && styles.tabError,
          ]}
        >
          <Text
            style={[
              styles.label,
              (focused || error != null) && styles.labelOnLight,
            ]}
          >
            {label}
            {optional && (
              <Text style={styles.optional}> ({dict.OPTIONAL_LABEL})</Text>
            )}
          </Text>
        </View>
        {showCounter && (
          <Text
            style={[
              styles.counter,
              value.length >= maxLength && styles.counterFull,
            ]}
          >
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          error != null && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={PLACEHOLDER_COLOR}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {canClear && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_CLEAR_INPUT}
            activeOpacity={0.7}
            hitSlop={8}
            onPress={() => onChangeText("")}
            style={styles.clear}
          >
            <MaterialIcons
              name="cancel"
              size={THEME.ICON.MD}
              color={PLACEHOLDER_COLOR}
            />
          </TouchableOpacity>
        )}
      </View>
      {error != null && (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.errorRow}
        >
          <MaterialIcons
            name="error-outline"
            size={scale(16)}
            color={THEME.COLORS.ERROR}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}
