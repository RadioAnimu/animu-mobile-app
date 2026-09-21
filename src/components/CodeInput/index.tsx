import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { styles } from "@/components/CodeInput/styles";

/** Digits the Animu Connect email code is made of. */
export const CODE_LENGTH = 4;

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  /** Number of boxes — also the maximum number of digits. */
  length?: number;
  editable?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * One field, N boxes.
 *
 * A single TextInput spans the whole row (invisible, on top) so the OS sees
 * one focusable field — one keyboard, one value, and paste/one-time-code
 * autofill keep working — while each digit paints into its own box and a
 * caret marks the box being typed.
 */
export function CodeInput({
  value,
  onChangeText,
  length = CODE_LENGTH,
  editable = true,
  accessibilityLabel,
  style,
  textStyle,
}: Props) {
  const [focused, setFocused] = useState(false);
  const caret = useRef(new Animated.Value(1)).current;

  const digits = value.replace(/\D/g, "").slice(0, length);
  const chars = Array.from({ length }, (_, index) => digits[index] ?? "");
  const activeIndex = digits.length < length ? digits.length : -1;

  useEffect(() => {
    if (!focused || !editable) {
      caret.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(caret, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [caret, editable, focused]);

  return (
    <View style={[styles.row, style]}>
      {chars.map((char, index) => (
        <View
          key={index}
          accessible={false}
          style={[
            styles.box,
            focused && styles.boxFocused,
            focused && index === activeIndex && styles.boxActive,
            !editable && styles.boxDisabled,
          ]}
        >
          {char ? (
            <Text style={[styles.digit, textStyle]}>{char}</Text>
          ) : focused && index === activeIndex ? (
            <Animated.View style={[styles.caret, { opacity: caret }]} />
          ) : null}
        </View>
      ))}

      <TextInput
        value={digits}
        onChangeText={(text) =>
          onChangeText(text.replace(/\D/g, "").slice(0, length))
        }
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={editable}
        caretHidden
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
    </View>
  );
}
