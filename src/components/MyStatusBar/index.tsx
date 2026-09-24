import { StatusBar } from "react-native";

/**
 * Edge-to-edge means no native status bar background: the color behind
 * the system icons comes from the headers, which extend under the bar.
 * `translucent` and `backgroundColor` are ignored no-ops on Android
 * edge-to-edge (mandatory since SDK 57 / RN 0.86), so only the bar style
 * is configured here.
 */
export const MyStatusBar = () => <StatusBar barStyle="light-content" />;
