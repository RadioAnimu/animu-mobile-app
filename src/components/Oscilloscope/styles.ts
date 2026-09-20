import { StyleSheet } from "react-native";
import { SCREEN_WIDTH, scale } from "@/theme/responsive";

/**
 * Geometry preserved from the original WebView oscilloscope: a full-width
 * strip pinned to the top of the Home screen, with the wave centered inside
 * it and the logo drawn on top. Both are authored at the 393pt reference
 * and scaled together so the logo stays aligned over the trace.
 */
export const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: scale(127),
    position: "absolute",
    top: 0,
    justifyContent: "center",
  },
});
