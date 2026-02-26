import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerApp: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  buttons: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  listenersWrapper: {
    marginBottom: 10,
  },
  coverWrapper: {
    marginBottom: 11,
  },
  timeRemainingWrapper: {
    marginTop: 10,
    marginBottom: 8,
  },
  liveWrapper: {
    marginBottom: 9,
  },
  programWrapper: {
    marginBottom: 9,
  },
  /*
  oscilloscopeAndLogo: {
    alignItems: "center",
  },
  */
});
