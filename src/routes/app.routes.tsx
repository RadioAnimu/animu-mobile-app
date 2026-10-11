import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";

import { useWindowDimensions } from "react-native";
import { CustomDrawerContent, DrawerIcon } from "@/components/CustomDrawer";
import { MakeRequest } from "@/screens/MakeRequest";
import { Home } from "@/screens/Home";
import { History } from "@/screens/History";
import { DESTINATION_ICON } from "@/constants/destination-icons";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { Settings } from "@/screens/Settings";
import { Stats } from "@/screens/Stats";
import { Storage } from "@/screens/Storage";
import { Login } from "@/screens/Login";
import { Account } from "@/screens/Account";
import { About } from "@/screens/About";
import { Lyrics } from "@/screens/Lyrics";
import { useDict } from "@/hooks/useDict";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { HistoryType } from "animu-api";

interface HistoryProps {
  historyType: HistoryType;
}

/** The top-level destinations the drawer switches between. */
export type DrawerParamList = {
  Home: undefined;
  LastRequested: HistoryProps;
  LastPlayed: HistoryProps;
  MakeRequest: undefined;
};

/**
 * Detail pages pushed on top of the drawer. A real stack gives them the
 * platform push/pop transition, the iOS edge swipe-back and Android's
 * predictive back — the drawer alone swapped them in with no motion at all.
 */
export type DetailParamList = {
  Settings: undefined;
  Stats: undefined;
  Storage: undefined;
  Login: undefined;
  Account: undefined;
  About: undefined;
  Lyrics: undefined;
};

export type RootStackParamList = DetailParamList & {
  Main: NavigatorScreenParams<DrawerParamList> | undefined;
};

/** Every route name, for helpers that navigate by name from anywhere. */
export type AppRouteName = keyof DrawerParamList | keyof DetailParamList;

const Drawer = createDrawerNavigator<DrawerParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const DRAWER_WIDTH_RATIO = 0.8;

// Module-level on purpose: render callbacks defined inside AppRoutes get a new
// identity every render, which remounts the drawer content / menu icons.
const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawerContent {...props} />
);

const playerIcon = ({ color }: { color: string }) => (
  <DrawerIcon name={DESTINATION_ICON.Home} color={color} />
);
const lastRequestedIcon = ({ color }: { color: string }) => (
  <DrawerIcon name={DESTINATION_ICON.LastRequested} color={color} />
);
const lastPlayedIcon = ({ color }: { color: string }) => (
  <DrawerIcon name={DESTINATION_ICON.LastPlayed} color={color} />
);
const makeRequestIcon = ({ color }: { color: string }) => (
  <DrawerIcon name={DESTINATION_ICON.MakeRequest} color={color} />
);

function DrawerRoutes() {
  const dict = useDict();
  const { width } = useWindowDimensions();

  return (
    <Drawer.Navigator
      // Back (hardware) returns to the destination you came from, not
      // always to the player.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        overlayColor: THEME.COLORS.SCRIM,
        overlayAccessibilityLabel: dict.A11Y_CLOSE_MENU,
        drawerStyle: {
          backgroundColor: THEME.COLORS.SURFACE,
          width: width * DRAWER_WIDTH_RATIO,
        },
      }}
      drawerContent={renderDrawerContent}
    >
      <Drawer.Screen
        options={{
          drawerLabel: dict.MENU_PLAYER,
          drawerIcon: playerIcon,
        }}
        name="Home"
        component={Home}
      />
      <Drawer.Screen
        options={{
          drawerLabel: dict.MENU_LAST_REQUESTED,
          drawerIcon: lastRequestedIcon,
        }}
        name="LastRequested"
        component={History}
        initialParams={{ historyType: "requests" }}
      />
      <Drawer.Screen
        options={{
          drawerLabel: dict.MENU_LAST_PLAYED,
          drawerIcon: lastPlayedIcon,
        }}
        name="LastPlayed"
        component={History}
        initialParams={{ historyType: "played" }}
      />
      <Drawer.Screen
        options={{
          drawerLabel: dict.MENU_MAKE_REQUEST,
          drawerIcon: makeRequestIcon,
        }}
        name="MakeRequest"
        component={MakeRequest}
      />
    </Drawer.Navigator>
  );
}

/** Opaque scene for the settings-style pages, so the push never shows through. */
const DETAIL_CONTENT = { backgroundColor: THEME.COLORS.BG_DEEP } as const;
/** Login paints the app artwork itself; the scene behind it stays the app tone. */
const LOGIN_CONTENT = { backgroundColor: THEME.COLORS.APP_BG } as const;

export function AppRoutes() {
  const reduceMotion = useReducedMotion();

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
    contentStyle: DETAIL_CONTENT,
    // Platform push/pop by default; a plain cross-fade when the system asks
    // for reduced motion.
    animation: reduceMotion ? "fade" : "default",
    // iOS plays fades and the bottom slide over 500ms by default — twice the
    // app's tempo. (The platform push and Android's transitions are native.)
    animationDuration: MOTION.DURATION.SCREEN,
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={DrawerRoutes}
        // The drawer root shows the app artwork behind its screens.
        options={{ contentStyle: { backgroundColor: "transparent" } }}
      />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="Stats" component={Stats} />
      <Stack.Screen name="Storage" component={Storage} />
      <Stack.Screen
        name="Login"
        component={Login}
        options={{ contentStyle: LOGIN_CONTENT }}
      />
      <Stack.Screen name="Account" component={Account} />
      <Stack.Screen name="About" component={About} />
      <Stack.Screen
        name="Lyrics"
        component={Lyrics}
        // Rises over the player like Apple Music's lyrics; the screen paints
        // its own backdrop (the cover's colors) over the app tone.
        options={{
          presentation: "fullScreenModal",
          animation: reduceMotion ? "fade" : "slide_from_bottom",
          contentStyle: DETAIL_CONTENT,
        }}
      />
    </Stack.Navigator>
  );
}
