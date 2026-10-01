import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

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
}: {
  dict: Dict;
  items: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <ScrollView
      style={styles.recent}
      contentContainerStyle={styles.recentContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
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

      <View>
        {items.map((item, index) => (
          <View key={item}>
            {index > 0 && <View style={styles.recentDivider} />}
            <View style={styles.recentRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item}
                activeOpacity={0.7}
                onPress={() => onPick(item)}
                style={styles.recentPick}
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
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${dict.REQUEST_SEARCH_RECENT_REMOVE}: ${item}`}
                hitSlop={8}
                onPress={() => onRemove(item)}
                style={styles.recentRemove}
              >
                <MaterialIcons
                  name="close"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT_DIM}
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
