import { useEffect, useRef, useState } from "react";
import { Animated, Text, TextInput, View } from "react-native";

import { styles } from "@/components/CodeInput/styles";

/** Digits the Animu Connect email code is made of. */
export const CODE_LENGTH = 4;

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  /** Focus the hidden field on mount (the code step just appeared). */
  autoFocus?: boolean;
  accessibilityLabel?: string;
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
  editable = true,
  autoFocus = false,
  accessibilityLabel,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const caretRef = useRef<Animated.Value | null>(null);
  caretRef.current ??= new Animated.Value(1);
  const caret = caretRef.current;

  // A verify flips `editable` off while it runs, which blurs the field on
  // Android and drops the keyboard. Pull focus back when editing returns, so
  // a retyped code needs no extra tap to land in the boxes.
  const wasEditable = useRef(editable);
  useEffect(() => {
    if (editable && !wasEditable.current) inputRef.current?.focus();
    wasEditable.current = editable;
  }, [editable]);

  const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
  const chars = Array.from({ length: CODE_LENGTH }, (_, index) => digits[index] ?? "");
  const activeIndex = digits.length < CODE_LENGTH ? digits.length : -1;

  useEffect(() => {
    if (!focused || !editable) {
      caret.setValue(1);
      return undefined;
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

  const boxContent = (char: string, index: number) => {
    if (char) return <Text style={styles.digit}>{char}</Text>;
    if (focused && index === activeIndex) {
      return <Animated.View style={[styles.caret, { opacity: caret }]} />;
    }
    return null;
  };

  return (
    <View style={styles.row}>
      {chars.map((char, index) => (
        <View
          key={index}
          accessible={false}
          style={[
            styles.box,
            focused && index === activeIndex && styles.boxActive,
            !editable && styles.boxDisabled,
          ]}
        >
          {boxContent(char, index)}
        </View>
      ))}

      <TextInput
        ref={inputRef}
        // The field is visually hidden (see styles.input); keep it in the
        // accessibility tree regardless of how the platform treats opacity.
        importantForAccessibility="yes"
        value={digits}
        onChangeText={(text) =>
          onChangeText(text.replace(/\D/g, "").slice(0, CODE_LENGTH))
        }
        keyboardType="number-pad"
        inputMode="numeric"
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
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
