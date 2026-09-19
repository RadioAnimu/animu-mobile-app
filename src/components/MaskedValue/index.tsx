import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { THEME } from "@/theme";

interface Props {
  /** The real value — shown only while revealed. */
  value: string;
  /** Turns the real value into its masked form. */
  mask: (value: string) => string;
  /** Accessibility labels for the reveal control. */
  showLabel: string;
  hideLabel: string;
  /** Text style so the value matches whatever row it sits in. */
  textStyle?: StyleProp<TextStyle>;
  iconSize?: number;
  hint?: string;
}

const AUTO_HIDE_MS = 5000;

/**
 * A personal identifier (email, handle, id) that renders masked by default
 * and reveals on tap. The eye sits right next to the value it protects, so
 * nothing is buried behind a long-press or a global setting.
 */
export function MaskedValue({
  value,
  mask,
  showLabel,
  hideLabel,
  textStyle,
  iconSize = 16,
  hint,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [hintVisible, setHintVisible] = useState(Boolean(hint));
  const [motion] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(motion, {
      toValue: revealed ? 1 : 0,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [motion, revealed]);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      setRevealed(false);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  const toggle = () => {
    setHintVisible(false);
    setRevealed((current) => !current);
  };

  const scale = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  return (
    <View style={styles.stack}>
      <Animated.View
        style={[
          styles.row,
          {
            opacity: revealed ? 1 : THEME.OPACITY.SOFT,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.value, textStyle]} numberOfLines={1}>
          {revealed ? value : mask(value)}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={revealed ? hideLabel : showLabel}
          activeOpacity={0.7}
          hitSlop={10}
          onPress={toggle}
        >
          <MaterialIcons
            name={revealed ? "visibility-off" : "visibility"}
            size={iconSize}
            color={THEME.COLORS.TEXT_DIM}
          />
        </TouchableOpacity>
      </Animated.View>
      {hint && hintVisible && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexShrink: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  value: {
    flexShrink: 1,
  },
  hint: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    marginTop: THEME.SPACE.XXS,
  },
});
