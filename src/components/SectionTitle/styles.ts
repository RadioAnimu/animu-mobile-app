import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const SECTION_ICON_SIZE = 18;
const ICON_BOX_WIDTH = 32;

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
    width: ICON_BOX_WIDTH,
    alignItems: "center",
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: 1.2,
    marginLeft: THEME.SPACE.SM,
  },
});
