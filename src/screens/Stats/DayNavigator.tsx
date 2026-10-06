import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@/components/Icon";
import { dayKeyOf } from "@/core/services/listen-stats.service";
import type { Dict } from "@/i18n";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

/** Comfortable alternative to precision-tapping a dense heatmap cell. */
export function DayNavigator({ selected, onSelect, dict }: {
  selected: string | null;
  onSelect: (day: string) => void;
  dict: Dict;
}) {
  const [today, setToday] = useState(() => dayKeyOf(Date.now()));
  useFocusEffect(useCallback(() => { setToday(dayKeyOf(Date.now())); }, []));
  const key = selected ?? today;
  const [year, month, day] = key.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const first = new Date(ty, tm - 1, td - todayDate.getDay() - (THEME.CHART.HEAT_WEEKS - 1) * 7);
  const canGoBack = key > dayKeyOf(first.getTime());
  const move = (delta: number) => {
    const next = new Date(year, month - 1, day + delta);
    haptics.select();
    onSelect(dayKeyOf(next.getTime()));
  };
  return (
    <View style={styles.row}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={dict.STATS_PREVIOUS_DAY} accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} activeOpacity={THEME.OPACITY.PRESSED} style={styles.button} onPress={() => move(-1)}>
        <Icon name="chevron-left" size={THEME.ICON.LG} color={canGoBack ? THEME.COLORS.TEXT : THEME.COLORS.TEXT_DIM} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityHint={dict.STATS_HEATMAP_HINT} accessibilityState={{ selected: selected != null }} activeOpacity={THEME.OPACITY.PRESSED} style={styles.date} onPress={() => onSelect(key)}>
        <Text style={styles.label}>{`${day} ${dict.STATS_MONTHS[month - 1]} ${year}`}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={dict.STATS_NEXT_DAY} accessibilityState={{ disabled: key >= today }} disabled={key >= today} activeOpacity={THEME.OPACITY.PRESSED} style={styles.button} onPress={() => move(1)}>
        <Icon name="chevron-right" size={THEME.ICON.LG} color={key >= today ? THEME.COLORS.TEXT_DIM : THEME.COLORS.TEXT} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: THEME.SPACE.MD, paddingBottom: THEME.SPACE.SM },
  button: { width: THEME.LAYOUT.TOUCH_TARGET, minHeight: THEME.LAYOUT.TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  date: { flex: 1, minHeight: THEME.LAYOUT.TOUCH_TARGET, justifyContent: "center" },
  label: { color: THEME.COLORS.TEXT, fontFamily: THEME.FONT_FAMILY.BOLD, fontSize: THEME.FONT_SIZE.BODY, textAlign: "center" },
});
