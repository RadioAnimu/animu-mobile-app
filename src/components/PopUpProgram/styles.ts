import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.COLORS.OVERLAY,
  },
  content: {
    width: 311,
    backgroundColor: THEME.COLORS.PRIMARY,
    alignItems: "center",
    borderRadius: 8,
    padding: 8,
  },
  closeIcon: {
    alignSelf: "flex-end",
    margin: 8,
  },
  img: {
    height: 127,
    width: "100%",
    borderRadius: 8,
    resizeMode: "contain",
  },
  informationBlock: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
  },
  label: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
