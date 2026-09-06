import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { THEME } from "../../theme";

/**
 * Minimalist flash card: fades in at the bottom of the screen, holds for a
 * moment and fades itself out. Purely informational — pointerEvents="none"
 * so it never intercepts touches, and no dismiss button.
 */
export const Toast = React.memo(function Toast({
  message,
  duration = 1800,
  onDone,
}: {
  message: string;
  duration?: number;
  onDone?: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(progress, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => animation.stop();
  }, [progress, duration, onDone]);

  const rise = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity: progress, transform: [{ translateY: rise }] }]}
    >
      <MaterialIcons
        name="check-circle"
        size={16}
        color={THEME.COLORS.BRAND}
      />
      <Text style={styles.text} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: THEME.COLORS.SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    maxWidth: "86%",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    flexShrink: 1,
  },
});
