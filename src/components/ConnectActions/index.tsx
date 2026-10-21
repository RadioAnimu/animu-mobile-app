import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";
import { interpolate } from "@/utils/format";

interface Props {
  /** A send/verify is in flight — both actions lock. */
  busy: boolean;
  /** Seconds left on the resend lockout (0 = resend is available). */
  resendRemaining: number;
  onResend: () => void;
}

/**
 * The code step's secondary action — "resend code", with its countdown.
 * Shared by the Login screen and the Account screen's add-email form so both
 * Animu Connect forms stay in step. Changing the address lives on the
 * address row itself ({@link EmailCodeEmailRow}).
 */
export function ConnectActions({
  busy,
  resendRemaining,
  onResend,
}: Readonly<Props>) {
  const dict = useDict();
  const resendLocked = busy || resendRemaining > 0;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={THEME.OPACITY.PRESSED}
        disabled={resendLocked}
        style={styles.action}
        onPress={() => {
          haptics.tap();
          onResend();
        }}
      >
        <Text style={[styles.link, resendLocked && styles.disabled]}>
          {resendRemaining > 0
            ? interpolate(dict.LOGIN_CODE_RESEND_IN, {
                seconds: resendRemaining,
              })
            : dict.LOGIN_CODE_RESEND}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.MD,
  },
  // Text-only links: vertical padding lifts the tap area toward 44pt.
  action: {
    paddingVertical: THEME.SPACE.MD,
  },
  link: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    // The resend countdown ticks inside a centered row: tabular figures keep
    // the label from sliding sideways every second.
    fontVariant: ["tabular-nums"],
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
