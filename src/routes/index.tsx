import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { AppRoutes } from "@/routes/app.routes";
import { THEME } from "@/theme";

/**
 * The app paints its own full-screen artwork behind the navigator
 * (`App.tsx` wraps everything in `<Background>`), so the navigator's scene
 * background must stay transparent. React Navigation's default is an opaque
 * near-white (`rgb(242, 242, 242)`) applied by `Screen` to every scene —
 * screens with no background of their own (Home, History, MakeRequest)
 * showed white instead of the artwork until this was overridden.
 */
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "transparent",
    primary: THEME.COLORS.BRAND,
    card: THEME.COLORS.SURFACE,
    text: THEME.COLORS.TEXT,
    border: THEME.COLORS.HAIRLINE,
    notification: THEME.COLORS.ERROR,
  },
};

export function Routes() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <AppRoutes />
    </NavigationContainer>
  );
}
