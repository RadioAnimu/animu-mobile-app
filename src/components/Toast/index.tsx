import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export type ToastVariant = "success" | "error" | "info";

/** Failures linger longer than confirmations — they take longer to read. */
const TOAST_HOLD_MS: Record<ToastVariant, number> = {
  success: 1800,
  info: 2400,
  error: 4000,
};

const VARIANT_STYLE = {
  success: { icon: "check-circle", color: THEME.COLORS.BRAND },
  info: { icon: "info", color: THEME.COLORS.TEXT_SOFT },
  error: { icon: "error", color: THEME.COLORS.ERROR },
} as const;

/**
 * Minimalist flash card: fades in at the bottom of the screen, holds for a
 * moment and fades itself out. Purely informational — pointerEvents="none"
 * so it never intercepts touches, and no dismiss button.
 */
export const Toast = React.memo(function Toast({
  message,
  variant = "success",
  onDone,
}: {
  message: string;
  variant?: ToastVariant;
  onDone?: () => void;
}) {
  const holdMs = TOAST_HOLD_MS[variant];
  const progress = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.delay(holdMs),
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
  }, [progress, onDone, holdMs]);

  const rise = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scale(14), 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole={variant === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        variant === "error" && styles.toastError,
        { opacity: progress, transform: [{ translateY: rise }] },
      ]}
    >
      <MaterialIcons
        name={VARIANT_STYLE[variant].icon}
        size={scale(16)}
        color={VARIANT_STYLE[variant].color}
      />
      <Text style={styles.text} numberOfLines={2}>
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
    borderRadius: scale(20),
    backgroundColor: THEME.COLORS.SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    maxWidth: "86%",
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.35)",
  },
  toastError: {
    borderWidth: THEME.BORDER_WIDTH.THIN,
    borderColor: THEME.COLORS.ERROR,
  },
  text: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    flexShrink: 1,
  },
});
