import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";

export const styles = StyleSheet.create({
  row: {
    ...ROW_STYLES.row,
    justifyContent: "space-between",
  },
  rowDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  iconBox: ROW_STYLES.iconBox,
  // With a supporting line: generous vertical padding so the two lines breathe.
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
    paddingRight: THEME.SPACE.LG,
  },
  // Single-label rows: no extra vertical padding, so the label and the
  // trailing control sit dead-center on the row.
  bodySingle: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    justifyContent: "center",
    paddingRight: THEME.SPACE.LG,
  },
  label: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  description: ROW_STYLES.description,
  divider: ROW_STYLES.divider,
});
