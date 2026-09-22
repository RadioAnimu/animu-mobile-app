import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const SECTION_ICON_SIZE = scale(18);

export const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    // Same inset + icon column as the rows below, so headings and row labels
    // share one vertical grid instead of drifting a few pixels apart.
    paddingHorizontal: THEME.SPACE.LG,
    marginTop: THEME.SPACE.XXL,
    marginBottom: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.MD,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  sectionFirst: {
    marginTop: 0,
  },
  iconBox: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: scale(1.2),
  },
});
