import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { AppRoutes, type RootStackParamList } from "@/routes/app.routes";
import { applyOrientationPolicy } from "@/routes/orientation";

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
  const navigation = useNavigationContainerRef<RootStackParamList>();
  // Phones turn to landscape on the player only (see `orientation.ts`).
  const applyOrientation = () => applyOrientationPolicy(navigation.getCurrentRoute()?.name);

  return (
    <NavigationContainer
      ref={navigation}
      theme={NAV_THEME}
      onReady={applyOrientation}
      onStateChange={applyOrientation}
    >
      <AppRoutes />
    </NavigationContainer>
  );
}
