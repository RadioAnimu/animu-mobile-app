import { THEME } from "@/theme";
import { StyleSheet } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Full-bleed scrim for the auth screens.
 *
 * The app artwork stays visible behind the login flow, but a flat overlay
 * kills its depth. Instead this layers a vertical gradient (lighter at the
 * top where the wordmark sits, deeper towards the action stack) with a soft
 * brand glow behind the hero, so the type and glass pills keep their contrast
 * while the screen still reads as part of the app.
 *
 * Rendered inside the screen root, not a safe area, so it also covers the
 * status bar strip (edge-to-edge).
 */
export function AuthBackdrop() {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
    >
      <Defs>
        <LinearGradient id="authScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={THEME.COLORS.AUTH_VIGNETTE} stopOpacity="0.66" />
          <Stop offset="0.4" stopColor={THEME.COLORS.AUTH_VIGNETTE} stopOpacity="0.58" />
          <Stop offset="0.72" stopColor={THEME.COLORS.AUTH_VIGNETTE_SOFT} stopOpacity="0.84" />
          <Stop offset="1" stopColor={THEME.COLORS.AUTH_VIGNETTE} stopOpacity="0.96" />
        </LinearGradient>
        <RadialGradient id="authGlow" cx="50%" cy="16%" r="60%">
          <Stop offset="0" stopColor={THEME.COLORS.BRAND} stopOpacity="0.12" />
          <Stop offset="0.5" stopColor={THEME.COLORS.BRAND} stopOpacity="0.04" />
          <Stop offset="1" stopColor={THEME.COLORS.BRAND} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#authScrim)" />
      <Rect width="100%" height="100%" fill="url(#authGlow)" />
    </Svg>
  );
}
