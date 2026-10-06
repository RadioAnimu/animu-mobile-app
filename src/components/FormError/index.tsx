import { Icon } from "@/components/Icon";
import { StyleSheet, Text, View } from "react-native";

import { THEME } from "@/theme";

interface Props {
  message: string;
  /** Centered copy for the full-screen auth form; left-aligned in sheets. */
  center?: boolean;
}

/**
 * Inline Auth failure notice, matching the request submit sheet: the error hue
 * on the icon and the message, no card around it.
 */
export function FormError({ message, center = false }: Readonly<Props>) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.row, center && styles.rowCentered]}
    >
      <Icon
        name="error"
        size={THEME.ICON.MD}
        color={THEME.COLORS.ERROR}
      />
      <Text style={[styles.text, !center && styles.textLeft]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  rowCentered: {
    justifyContent: "center",
  },
  text: {
    flexShrink: 1,
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    textAlign: "center",
  },
  textLeft: {
    flex: 1,
    textAlign: "left",
  },
});
