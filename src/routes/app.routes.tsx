import { createDrawerNavigator } from "@react-navigation/drawer";

import { useWindowDimensions } from "react-native";
import { CustomDrawerContent, DrawerIcon } from "@/components/CustomDrawer";
import { FazerPedido } from "@/screens/FazerPedido";
import { Home } from "@/screens/Home";
import { Last } from "@/screens/Ultimas";
import { THEME } from "@/theme";
import { Settings } from "@/screens/Settings";
import { Storage } from "@/screens/Storage";
import { Login } from "@/screens/Login";
import { Account } from "@/screens/Account";
import { useDict } from "@/hooks/useDict";
import { HistoryType } from "@/@types/history-type";

type HomeProps = undefined;
interface LastProps {
  historyType: HistoryType;
}
type FazerPedidoProps = undefined;
type SettingsProps = undefined;
type StorageProps = undefined;
type LoginProps = undefined;
type AccountProps = undefined;

export type RootStackParamList = {
  Home: HomeProps;
  LastRequested: LastProps;
  LastPlayed: LastProps;
  FazerPedido: FazerPedidoProps;
  Settings: SettingsProps;
  Storage: StorageProps;
  Login: LoginProps;
  Account: AccountProps;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

const DRAWER_WIDTH_RATIO = 0.8;

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
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Screen
        options={{
          drawerLabel: dict.MENU_PLAYER,
          drawerIcon: ({ color }) => <DrawerIcon name="play-circle" color={color} />,
        }}
        name="Home"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_LAST_REQUESTED,
          drawerIcon: ({ color }) => <DrawerIcon name="queue-music" color={color} />,
        }}
        name="LastRequested"
        component={Last}
        initialParams={{ historyType: "requests" }}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_LAST_PLAYED,
          drawerIcon: ({ color }) => <DrawerIcon name="history" color={color} />,
        }}
        name="LastPlayed"
        component={Last}
        initialParams={{ historyType: "played" }}
      />
      <Screen
        options={{
          drawerLabel: dict.MENU_MAKE_REQUEST,
          drawerIcon: ({ color }) => (
            <DrawerIcon name="music-note" color={color} />
          ),
        }}
        name="FazerPedido"
        component={FazerPedido}
      />
      <Screen
        options={{
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="Settings"
        component={Settings}
      />
      <Screen
        options={{
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="Storage"
        component={Storage}
      />
      <Screen
        options={{
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="Login"
        component={Login}
      />
      <Screen
        options={{
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="Account"
        component={Account}
      />
    </Navigator>
  );
}
