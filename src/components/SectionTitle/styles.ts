import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const SECTION_ICON_SIZE = scale(18);

export const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.SPACE.MD,
    marginTop: THEME.SPACE.XXL,
    marginBottom: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.MD,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  iconBox: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "center",
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: scale(1.2),
    marginLeft: THEME.SPACE.SM,
  },
});
