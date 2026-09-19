import { StyleSheet } from "react-native";

import { THEME } from "@/theme";

const CARD_RADIUS = 14;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  appContainer: {
    flexGrow: 1,
    width: "85%",
    paddingBottom: THEME.SPACE.XXXL,
    alignSelf: "center",
  },
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
  },
  deviceCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    marginTop: THEME.SPACE.SM,
    paddingHorizontal: THEME.SPACE.XS,
  },
});
