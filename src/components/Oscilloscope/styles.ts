import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

/**
 * Geometry preserved from the original WebView oscilloscope: a full-width
 * strip pinned to the top of the Home screen, with the wave centered inside
 * it and the logo drawn on top. The widths come from `useWindowDimensions`
 * (the WebView carries the current window, and the page sizes its canvas to
 * `window.innerWidth`), so both keep following a rotation/resize; heights
 * are authored at the 393pt reference and scaled with the logo so the logo
 * stays aligned over the trace.
 */
export const styles = StyleSheet.create({
  // No width of its own: the wrap sizes to the WebView's reactive width.
  container: {
    height: THEME.LAYOUT.LOGO_HEIGHT,
    position: "absolute",
    top: 0,
  },
});
