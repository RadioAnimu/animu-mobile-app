import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

/**
 * Minimalist flash card: fades in at the bottom of the screen, holds for a
 * moment and fades itself out. Purely informational — pointerEvents="none"
 * so it never intercepts touches, and no dismiss button.
 */
const TOAST_HOLD_MS = 1800;

export const Toast = React.memo(function Toast({
  message,
  onDone,
}: {
  message: string;
  onDone?: () => void;
}) {
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(TOAST_HOLD_MS),
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
  }, [progress, onDone]);

  const rise = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scale(14), 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity: progress, transform: [{ translateY: rise }] }]}
    >
      <MaterialIcons
        name="check-circle"
        size={scale(16)}
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
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: 999,
    backgroundColor: THEME.COLORS.SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    maxWidth: "86%",
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.35)",
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    flexShrink: 1,
  },
});
