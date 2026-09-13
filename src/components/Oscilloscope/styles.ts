import { Dimensions, StyleSheet } from "react-native";

/**
 * Geometry preserved from the original WebView oscilloscope: a full-width
 * 127px strip pinned to the top of the Home screen, with the 75px wave
 * centered inside it and the logo drawn on top.
 */
export const styles = StyleSheet.create({
  container: {
    width: Dimensions.get("window").width,
    height: 127,
    position: "absolute",
    top: 0,
    justifyContent: "center",
  },
  canvas: {
    width: "100%",
    height: 75,
  },
});
