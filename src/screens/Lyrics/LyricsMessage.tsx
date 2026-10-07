import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { THEME } from "@/theme";
import { styles } from "@/screens/Lyrics/styles";

interface Props {
  icon?: IconName;
  title: string;
  hint?: string;
  loading?: boolean;
  action?: { label: string; onPress: () => void };
}

/** A centered state: looking, nothing found, instrumental, failed. */
export function LyricsMessage({ icon, title, hint, loading, action }: Readonly<Props>) {
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      {loading ? (
        <ActivityIndicator color={THEME.COLORS.TEXT} />
      ) : (
        icon && <Icon name={icon} size={THEME.ICON.XL} color={THEME.COLORS.TEXT_SOFT} />
      )}
      <Text style={styles.messageTitle}>{title}</Text>
      {hint ? <Text style={styles.messageHint}>{hint}</Text> : null}
      {action ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={THEME.OPACITY.PRESSED}
          onPress={action.onPress}
          style={styles.pill}
        >
          <Text style={styles.pillText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
