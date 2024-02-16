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
    justifyContent: "center",
    borderRadius: 8,
  },
  closeIcon: {
    alignSelf: "flex-end",
    margin: 16,
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    marginTop: 24,
    marginBottom: 8,
  },
});
