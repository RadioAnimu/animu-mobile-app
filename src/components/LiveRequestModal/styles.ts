import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
  },
  field: {
    width: "85%",
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
    width: "100%",
  },
  label: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "left",
    marginTop: THEME.SPACE.MD,
    marginBottom: THEME.SPACE.XS,
    width: "100%",
  },
  input: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    backgroundColor: THEME.COLORS.TEXT,
    textAlign: "left",
    paddingVertical: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.MD,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
    marginBottom: THEME.SPACE.XS,
  },
  inputDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  okButton: {
    marginVertical: THEME.SPACE.MD,
    backgroundColor: THEME.COLORS.BRAND,
    padding: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
  },
  okText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
