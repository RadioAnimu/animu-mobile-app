import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Text, TouchableOpacity, View } from "react-native";

import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { styles } from "@/screens/MakeRequest/styles";

/**
 * The last few successful searches, shown while the empty field is focused so
 * a repeat search is one tap instead of a full retype.
 */
export function RecentSearches({
  dict,
  items,
  onPick,
  onClear,
}: {
  dict: Dict;
  items: string[];
  onPick: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.recent}>
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>{dict.REQUEST_SEARCH_RECENT}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={dict.REQUEST_SEARCH_RECENT_CLEAR}
          hitSlop={8}
          onPress={onClear}
        >
          <Text style={styles.recentClear}>
            {dict.REQUEST_SEARCH_RECENT_CLEAR}
          </Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => (
        <TouchableOpacity
          key={item}
          accessibilityRole="button"
          accessibilityLabel={item}
          activeOpacity={0.7}
          onPress={() => onPick(item)}
          style={styles.recentRow}
        >
          <MaterialIcons
            name="history"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
          <Text style={styles.recentText} numberOfLines={1}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
