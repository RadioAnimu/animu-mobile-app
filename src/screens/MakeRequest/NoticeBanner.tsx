import { Text, TouchableOpacity, View } from "react-native";

import { THEME } from "@/theme";
import { styles } from "@/screens/MakeRequest/styles";

/**
 * Tonal bar with a one-line message and a brand action chip. Shared by the
 * failed-search retry and the "you can't request yet" eligibility notice so
 * both read as the same kind of inline hint.
 */
export function NoticeBanner({
  message,
  actionLabel,
  onAction,
}: Readonly<{
  message: string;
  actionLabel: string;
  onAction: () => void;
}>) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{message}</Text>
      <TouchableOpacity
        activeOpacity={THEME.OPACITY.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        // The chip is ~26pt tall; MD slop takes its target past 44 without
        // fattening the bar.
        hitSlop={THEME.HIT_SLOP.MD}
        onPress={onAction}
        style={styles.noticeAction}
      >
        {/* Fixed-size chip: capped so large system text can't blow it up. */}
        <Text
          style={styles.noticeActionText}
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        >
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
