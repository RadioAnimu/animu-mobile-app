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
  ultimasPedidasImage: {
    width: "100%",
    height: 127,
    marginVertical: 15,
    resizeMode: "contain",
  },
  musicapedidaname: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.ULTIMAS_PEDIDAS,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    flex: 1,
  },
  containerList: {
    gap: 10,
  },
  musicapedidatime: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    marginLeft: "auto",
  },
  metadata: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 10,
    alignItems: "center",
    minWidth: "100%",
  },
  image: {
    width: 50,
    height: 50,
    resizeMode: "cover",
    borderRadius: 12,
    borderColor: THEME.COLORS.COVER,
    borderWidth: 2,
  },
});
