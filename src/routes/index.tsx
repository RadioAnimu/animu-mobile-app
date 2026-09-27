import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { AppRoutes } from "@/routes/app.routes";

/**
 * The app paints its own full-screen artwork behind the navigator
 * (`App.tsx` wraps everything in `<Background>`), so the navigator's scene
 * background must stay transparent. React Navigation's default is an opaque
 * near-white (`rgb(242, 242, 242)`) applied by `Screen` to every scene —
 * screens with no background of their own (Home, History, MakeRequest)
 * showed white instead of the artwork until this was overridden.
 */
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};

export function Routes() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <AppRoutes />
    </NavigationContainer>
  );
}
