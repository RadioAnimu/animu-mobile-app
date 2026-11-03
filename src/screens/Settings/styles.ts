import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  appContainer: SCREEN_STYLES.content,
  group: SCREEN_STYLES.group,
  groupSpaced: {
    ...SCREEN_STYLES.group,
    marginTop: THEME.SPACE.XXL,
  },
});
