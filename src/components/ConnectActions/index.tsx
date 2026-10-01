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
  onChangeEmail: () => void;
}

/**
 * The code step's secondary actions — "resend code" (with its countdown) and
 * "use a different email". Shared by the Login screen and the Account
 * screen's add-email form so both Animu Connect forms stay in step.
 */
export function ConnectActions({
  busy,
  resendRemaining,
  onResend,
  onChangeEmail,
}: Props) {
  const dict = useDict();
  const resendLocked = busy || resendRemaining > 0;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
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
      <Text style={styles.dot}>•</Text>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.7}
        disabled={busy}
        style={styles.action}
        onPress={onChangeEmail}
      >
        <Text style={[styles.link, busy && styles.disabled]}>
          {dict.LOGIN_CODE_CHANGE_EMAIL}
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
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  dot: {
    color: THEME.COLORS.TEXT_DIM,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
