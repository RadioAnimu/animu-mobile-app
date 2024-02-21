import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    flexDirection: "column-reverse",
    backgroundColor: THEME.COLORS.OVERLAY,
  },
  content: {
    width: "100%",
    backgroundColor: THEME.COLORS.PRIMARY,
    alignItems: "center",
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    paddingBottom: 10,
  },
  closeArea: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    height: 35,
    alignItems: "center",
  },
  closeAreaIcon: {
    height: 18,
    resizeMode: "contain",
  },
  img: {
    height: 140,
    width: "100%",
    borderRadius: 8,
    resizeMode: "contain",
    marginBottom: 20,
  },
  text: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
    textAlign: "center",
    marginBottom: 20,
    width: "85%",
  },
  input: {
    color: THEME.COLORS.WHITE_TEXT,
    backgroundColor: THEME.COLORS.FAZER_PEDIDO,
    textAlign: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    width: "85%",
    borderRadius: 8,
    marginBottom: 20,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  okButton: {
    backgroundColor: THEME.COLORS.SHAPE,
    padding: 10,
    borderRadius: 8,
  },
  okText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
});
