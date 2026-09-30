import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";

import { useWindowDimensions } from "react-native";
import { CustomDrawerContent, DrawerIcon } from "@/components/CustomDrawer";
import { MakeRequest } from "@/screens/MakeRequest";
import { Home } from "@/screens/Home";
import { History } from "@/screens/History";
import { THEME } from "@/theme";
import { Settings } from "@/screens/Settings";
import { Stats } from "@/screens/Stats";
import { Storage } from "@/screens/Storage";
import { Login } from "@/screens/Login";
import { Account } from "@/screens/Account";
import { About } from "@/screens/About";
import { useDict } from "@/hooks/useDict";
import type { HistoryType } from "animu-api";

interface HistoryProps {
  historyType: HistoryType;
}

export type RootStackParamList = {
  Home: undefined;
  LastRequested: HistoryProps;
  LastPlayed: HistoryProps;
  MakeRequest: undefined;
  Settings: undefined;
  Stats: undefined;
  Storage: undefined;
  Login: undefined;
  Account: undefined;
  About: undefined;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

const DRAWER_WIDTH_RATIO = 0.8;

// Module-level on purpose: render callbacks defined inside AppRoutes get a new
// identity every render, which remounts the drawer content / menu icons.
const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawerContent {...props} />
);

const playerIcon = ({ color }: { color: string }) => (
  <DrawerIcon name="play-circle" color={color} />
);
const lastRequestedIcon = ({ color }: { color: string }) => (
  <DrawerIcon name="queue-music" color={color} />
);
const lastPlayedIcon = ({ color }: { color: string }) => (
  <DrawerIcon name="history" color={color} />
);
const makeRequestIcon = ({ color }: { color: string }) => (
  <DrawerIcon name="music-note" color={color} />
);

/** Routes reachable only via navigation (no drawer entry). */
const HIDDEN_ITEM_OPTIONS = { drawerItemStyle: { display: "none" } } as const;

export function AppRoutes() {
  const dict = useDict();
  const { width } = useWindowDimensions();

  return (
    <Navigator
      screenOptions={{
        headerShown: false,
        overlayColor: THEME.COLORS.SCRIM,
        drawerStyle: {
          backgroundColor: THEME.COLORS.SURFACE,
          width: width * DRAWER_WIDTH_RATIO,
        },
      }}
      drawerContent={renderDrawerContent}
    >
      <Screen
        options={{
          drawerLabel: dict.MENU_PLAYER,
          drawerIcon: playerIcon,
        }}
        name="Home"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_LAST_REQUESTED,
          drawerIcon: lastRequestedIcon,
        }}
        name="LastRequested"
        component={History}
        initialParams={{ historyType: "requests" }}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_LAST_PLAYED,
          drawerIcon: lastPlayedIcon,
        }}
        name="LastPlayed"
        component={History}
        initialParams={{ historyType: "played" }}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_MAKE_REQUEST,
          drawerIcon: makeRequestIcon,
        }}
        name="MakeRequest"
        component={MakeRequest}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="Settings"
        component={Settings}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="Stats"
        component={Stats}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="Storage"
        component={Storage}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="Login"
        component={Login}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="Account"
        component={Account}
      />
      <Screen
        options={HIDDEN_ITEM_OPTIONS}
        name="About"
        component={About}
      />
    </Navigator>
  );
}
