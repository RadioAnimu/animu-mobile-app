import { StyleSheet } from "react-native";

export const FALLBACK_HIDE_MS = 3000;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#270051",
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  spinner: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: "center",
  },
});
