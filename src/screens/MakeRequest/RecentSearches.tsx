import { Icon } from "@/components/Icon";
import { Text, TouchableOpacity, View } from "react-native";

import { KeyboardScrollView } from "@/components/KeyboardScrollView";

import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { styles } from "@/screens/MakeRequest/styles";

/**
 * The last few successful searches, shown whenever the field is empty so a
 * repeat search is one tap instead of a full retype. Scrolls inside the room
 * left above the keyboard; dragging it hides the keyboard.
 */
export function RecentSearches({
  dict,
  items,
  onPick,
  onRemove,
  onClear,
  bottomPadding,
}: Readonly<{
  dict: Dict;
  items: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  bottomPadding: number;
}>) {
  return (
    <KeyboardScrollView style={styles.recent}>
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>{dict.REQUEST_SEARCH_RECENT}</Text>
        <TouchableOpacity
          activeOpacity={THEME.OPACITY.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={dict.REQUEST_SEARCH_RECENT_CLEAR}
          hitSlop={THEME.HIT_SLOP.SM}
          onPress={onClear}
        >
          <Text style={styles.recentClear}>
            {dict.REQUEST_SEARCH_RECENT_CLEAR}
          </Text>
        </TouchableOpacity>
      </View>

      <View>
        {items.map((item, index) => (
          <View key={item}>
            {index > 0 && <View style={styles.recentDivider} />}
            <View style={styles.recentRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item}
                activeOpacity={THEME.OPACITY.PRESSED}
                onPress={() => onPick(item)}
                style={styles.recentPick}
              >
                <Icon
                  name="history"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT_DIM}
                />
                <Text style={styles.recentText} numberOfLines={1}>
                  {item}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={THEME.OPACITY.PRESSED}
                accessibilityRole="button"
                accessibilityLabel={`${dict.REQUEST_SEARCH_RECENT_REMOVE}: ${item}`}
                hitSlop={THEME.HIT_SLOP.SM}
                onPress={() => onRemove(item)}
                style={styles.recentRemove}
              >
                <Icon
                  name="close"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT_DIM}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
      {/* Clears the home indicator. */}
      <View style={{ height: bottomPadding }} />
    </KeyboardScrollView>
  );
}
