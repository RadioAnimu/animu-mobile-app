import { Icon } from "@/components/Icon";
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
  /**
   * The form is submitting: the field dims and ignores typing but keeps
   * focus, so the keyboard stays up for a retry (flipping `editable` off
   * would blur it and dismiss the keyboard).
   */
  busy?: boolean;
  inputRef?: Ref<TextInput>;
}

/** The counter only appears once the limit is within reach. */
const COUNTER_THRESHOLD = 0.8;

/** Placeholder and clear icon on the white field. */
const PLACEHOLDER_COLOR = "rgba(0, 0, 0, 0.45)";

interface HeaderProps {
  label: string;
  optional: boolean;
  focused: boolean;
  hasError: boolean;
  length: number;
  maxLength?: number;
}

/** Label tab, plus the length counter once the limit is within reach. */
function FieldHeader({
  label,
  optional,
  focused,
  hasError,
  length,
  maxLength,
}: Readonly<HeaderProps>) {
  const dict = useDict();
  const showCounter =
    maxLength != null && length >= maxLength * COUNTER_THRESHOLD;

  return (
    <View style={styles.tabRow}>
      <View
        style={[
          styles.tab,
          focused && styles.tabFocused,
          hasError && styles.tabError,
        ]}
      >
        <Text
          style={[styles.label, (focused || hasError) && styles.labelOnLight]}
        >
          {label}
          {optional && (
            <Text style={styles.optional}> ({dict.OPTIONAL_LABEL})</Text>
          )}
        </Text>
      </View>
      {showCounter && (
        <Text
          style={[styles.counter, length >= maxLength && styles.counterFull]}
        >
          {length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

/** Inline validation message, announced politely to screen readers. */
function FieldError({ message }: Readonly<{ message: string }>) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.errorRow}
    >
      <Icon
        name="error-outline"
        size={scale(16)}
        color={THEME.COLORS.ERROR}
      />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

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
  busy = false,
  inputRef,
  multiline = false,
  maxLength,
  ...inputProps
}: Readonly<Props>) {
  const dict = useDict();
  const [focused, setFocused] = useState(false);

  const hasError = error != null;
  const canClear = !multiline && editable && !busy && value.length > 0;

  return (
    <View style={styles.wrapper}>
      <FieldHeader
        label={label}
        optional={optional}
        focused={focused}
        hasError={hasError}
        length={value.length}
        maxLength={maxLength}
      />
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          hasError && styles.fieldError,
          (!editable || busy) && styles.fieldDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={(text) => {
            if (!busy) onChangeText(text);
          }}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={PLACEHOLDER_COLOR}
          accessibilityLabel={label}
          accessibilityState={{ busy }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {canClear && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_CLEAR_INPUT}
            activeOpacity={THEME.OPACITY.PRESSED}
            hitSlop={THEME.HIT_SLOP.SM}
            onPress={() => onChangeText("")}
            style={styles.clear}
          >
            <Icon
              name="cancel"
              size={THEME.ICON.MD}
              color={PLACEHOLDER_COLOR}
            />
          </TouchableOpacity>
        )}
      </View>
      {hasError && <FieldError message={error} />}
    </View>
  );
}
