import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";

/**
 * The address the code went to, on the code step: where the user just typed
 * it, now a quiet read-only summary (a "sent" mark, no input fill) so it
 * isn't mistaken for a field to tap, with "Change" where the clear button
 * was. It keeps the first step on screen so the second reads as its
 * continuation, and is the only way back to the email step.
 *
 * A long address ellipsizes in the middle (the domain stays visible) rather
 * than pushing "Change" out of the row. "Change" locks while a send/verify
 * runs, so the flow can't be steered from under an in-flight request.
 */
export function EmailCodeEmailRow({
  email,
  busy,
  onChangeEmail,
}: Readonly<{
  email: string;
  busy: boolean;
  onChangeEmail: () => void;
}>) {
  const dict = useDict();

  return (
    <View style={styles.field}>
      <Icon
        name="mark-email-read"
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT_SOFT}
      />
      <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
        {email}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={dict.A11Y_EMAIL_CODE_CHANGE}
        accessibilityState={{ disabled: busy }}
        activeOpacity={THEME.OPACITY.PRESSED}
        disabled={busy}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={onChangeEmail}
        style={styles.change}
      >
        <Text style={[styles.changeText, busy && styles.disabled]}>
          {dict.EMAIL_CODE_CHANGE}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// The email field's shape (EmailCodeFields styles) without its input fill: a
// read-only value sits on the subtle surface with a hairline edge.
const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    minHeight: THEME.LAYOUT.FIELD_HEIGHT,
    paddingLeft: THEME.SPACE.LG,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderWidth: 1,
    borderColor: THEME.COLORS.HAIRLINE,
  },
  email: {
    flex: 1,
    minWidth: 0,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  // Fills the row's full height and sits flush with its end, so the whole
  // right edge is the target rather than just the word.
  change: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: THEME.SPACE.LG,
  },
  changeText: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
