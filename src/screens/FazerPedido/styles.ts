import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "85%",
    marginBottom: 15,
    alignSelf: "center",
  },
  inputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 5,
    borderWidth: 3,
    borderColor: THEME.COLORS.FAZER_PEDIDO_BORDER,
    backgroundColor: THEME.COLORS.FAZER_PEDIDO,
    color: THEME.COLORS.WHITE_TEXT,
    textAlign: "left",
    paddingLeft: 10,
    marginRight: 10,
  },
  searchIcon: {
    height: 37,
    width: 37,
    borderRadius: 5,
    backgroundColor: THEME.COLORS.FAZER_PEDIDO,
    alignItems: "center",
    justifyContent: "center",
  },
});
