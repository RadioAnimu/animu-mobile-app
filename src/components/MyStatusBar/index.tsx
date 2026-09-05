import { StatusBar, StatusBarProps } from "react-native";
import { THEME } from "../../theme";

/**
 * Edge-to-edge means no native status bar background: the color behind
 * the system icons comes from the headers, which extend under the bar.
 * This only centralizes the bar configuration.
 */
export const MyStatusBar = (props: StatusBarProps) => (
  <StatusBar
    translucent
    backgroundColor={THEME.COLORS.SURFACE}
    barStyle="light-content"
    {...props}
  />
);
