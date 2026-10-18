import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { haptics } from "@/utils/haptics";

export type ToastVariant = "success" | "error" | "info";

/** Failures linger longer than confirmations — they take longer to read. */
const TOAST_HOLD_MS: Record<ToastVariant, number> = {
  success: 1800,
  info: 2400,
  error: 4000,
};

/** Actions take longer to be noticed and decided on — Material snackbar timing. */
const TOAST_ACTION_HOLD_MS = 5000;

const VARIANT_STYLE = {
  success: { icon: "check-circle", color: THEME.COLORS.BRAND },
  info: { icon: "info", color: THEME.COLORS.TEXT_SOFT },
  error: { icon: "error", color: THEME.COLORS.ERROR },
} as const;

/**
 * Minimalist flash card: fades in at the bottom of the screen, holds for a
 * moment and fades itself out. Purely informational — pointerEvents="none"
 * so it never intercepts touches, and no dismiss button.
 *
 * With an `action` it becomes an undo-style snackbar instead: the chip
 * surface and the action lettering take touches (`"auto"` — the wrapper
 * above it is `"box-none"`, so screen touches still pass through), holds
 * on longer, and the press runs the action once before the chip dismisses.
 */
export const Toast = React.memo(function Toast({
  message,
  variant = "success",
  action,
  onDone,
}: {
  message: string;
  variant?: ToastVariant;
  /** Text button at the end of the chip ("Undo"); its press dismisses. */
  action?: { label: string; onPress: () => void };
  onDone?: () => void;
}) {
  // Material snackbar guidance: an actionable chip needs its own, longer hold.
  const holdMs = action ? TOAST_ACTION_HOLD_MS : TOAST_HOLD_MS[variant];
  const progress = useMemo(() => new Animated.Value(0), []);
  const reduceMotion = useReducedMotion();
  // Set on the first press — a double tap must not re-run the action.
  const firedRef = useRef(false);

  /** One press, one outcome: fire helpfully once, then dismiss the chip. */
  const handleActionPress = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    haptics.select();
    action?.onPress();
    onDone?.();
  }, [action, onDone]);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: MOTION.DURATION.FAST,
        easing: MOTION.EASING.ENTER,
        useNativeDriver: true,
      }),
      Animated.delay(holdMs),
      Animated.timing(progress, {
        toValue: 0,
        duration: MOTION.DURATION.NORMAL,
        easing: MOTION.EASING.EXIT,
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
    // Reduce Motion: a plain fade, no rise.
    outputRange: [reduceMotion ? 0 : MOTION.RISE, 0],
  });

  return (
    <Animated.View
      pointerEvents={action ? "auto" : "none"}
      accessibilityRole={variant === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        variant === "error" && styles.toastError,
        { opacity: progress, transform: [{ translateY: rise }] },
      ]}
    >
      <Icon
        name={VARIANT_STYLE[variant].icon}
        size={THEME.ICON.SM}
        color={VARIANT_STYLE[variant].color}
      />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
      {action && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={action.label}
          activeOpacity={THEME.OPACITY.PRESSED}
          hitSlop={THEME.HIT_SLOP.SM}
          onPress={handleActionPress}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.LG,
    paddingVertical: THEME.SPACE.SM,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    maxWidth: "86%",
    boxShadow: [
      { offsetX: 0, offsetY: THEME.SPACE.XS, blurRadius: THEME.SPACE.SM, color: THEME.COLORS.SHADOW },
    ],
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
  actionText: {
    color: THEME.COLORS.BRAND,
    fontSize: THEME.FONT_SIZE.LABEL,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
