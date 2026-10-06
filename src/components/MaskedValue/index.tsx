import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MOTION } from "@/theme/motion";
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
}

const AUTO_HIDE_MS = THEME.FEEDBACK.MASK_AUTO_HIDE_MS;

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
  iconSize = THEME.ICON.SM,
}: Readonly<Props>) {
  const [revealed, setRevealed] = useState(false);
  const [motion] = useState(() => new Animated.Value(0));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const animation = Animated.spring(motion, {
      // Reduce Motion: the value just swaps, without the scale pop.
      toValue: revealed && !reduceMotion ? 1 : 0,
      ...MOTION.SPRING,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [motion, revealed, reduceMotion]);

  useEffect(() => {
    if (!revealed) return undefined;
    const timer = setTimeout(() => {
      setRevealed(false);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  const toggle = () => {
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
          activeOpacity={THEME.OPACITY.PRESSED}
          style={styles.revealButton}
          onPress={toggle}
        >
          <Icon
            name={revealed ? "visibility-off" : "visibility"}
            size={iconSize}
            color={THEME.COLORS.TEXT_DIM}
          />
        </TouchableOpacity>
      </Animated.View>
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
  revealButton: {
    width: THEME.LAYOUT.TOUCH_TARGET,
    minHeight: THEME.LAYOUT.TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    flexShrink: 1,
  },
});
