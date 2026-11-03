import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { THEME } from "@/theme";
import { styles } from "@/components/Notice/styles";

interface Props {
  icon: IconName;
  text: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A bordered, transparent explainer for a rule the user can't see from the
 * controls alone (who can request songs, where the stats are kept).
 */
export function Notice({ icon, text, style }: Readonly<Props>) {
  return (
    <View style={[styles.notice, style]}>
      <Icon name={icon} size={THEME.ICON.SM} color={THEME.COLORS.TEXT_SOFT} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
