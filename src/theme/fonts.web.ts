import { useFonts, type FontSource } from "expo-font";
import { THEME } from "@/theme";

/**
 * Web build: the config plugins embed nothing in a browser, so the fonts load
 * at startup — Proxima Nova (the same files the station's website serves)
 * and the Material Icons glyph font, under the family name the icon set
 * asks for on web. Ready once they load or fail (the system font then
 * stands in).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [THEME.FONT_FAMILY.REGULAR]: require("@/assets/fonts/proximanova-reg.ttf") as FontSource,
    [THEME.FONT_FAMILY.BOLD]: require("@/assets/fonts/proximanova-bold.ttf") as FontSource,
    "MaterialIcons-Regular": require("@react-native-vector-icons/material-icons/fonts/MaterialIcons.ttf") as FontSource,
  });
  return loaded || error != null;
}
