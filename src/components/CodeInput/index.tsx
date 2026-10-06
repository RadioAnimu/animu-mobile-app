import { useEffect, useRef, useState } from "react";
import { Animated, Text, TextInput, View } from "react-native";

import { styles } from "@/components/CodeInput/styles";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";

/** Digits the Animu Connect email code is made of. */
export const CODE_LENGTH = 4;

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  /**
   * A verify is in flight: the boxes dim and typing is ignored, but the
   * field stays editable and focused. Flipping `editable` off instead would
   * blur it and drop the keyboard mid-flow (both platforms resign the first
   * responder), so a retry would need an extra tap to bring it back.
   */
  busy?: boolean;
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
  busy = false,
  autoFocus = false,
  accessibilityLabel,
}: Readonly<Props>) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const [caret] = useState(() => new Animated.Value(1));
  const active = editable && !busy;

  useFocusOnMount(inputRef, autoFocus);

  const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
  const chars = Array.from({ length: CODE_LENGTH }, (_, index) => digits[index] ?? "");
  const activeIndex = digits.length < CODE_LENGTH ? digits.length : -1;

  useEffect(() => {
    if (!focused || !active) {
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
  }, [caret, active, focused]);

  const boxContent = (char: string, index: number) => {
    if (char) return <Text style={styles.digit}>{char}</Text>;
    if (focused && active && index === activeIndex) {
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
            focused && active && index === activeIndex && styles.boxActive,
            !active && styles.boxDisabled,
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
        onChangeText={(text) => {
          if (busy) return;
          onChangeText(text.replace(/\D/g, "").slice(0, CODE_LENGTH));
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        // Native focus in the mounting commit hands the keyboard straight
        // over from the outgoing email field; the mount hook above is the
        // fallback when that loses the race.
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        editable={editable}
        caretHidden
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
    </View>
  );
}
