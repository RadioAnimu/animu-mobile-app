/**
 * Native builds embed Proxima Nova through the `expo-font` config plugin
 * (app.json): the fonts are there before the first frame.
 */
export function useAppFonts(): boolean {
  return true;
}
