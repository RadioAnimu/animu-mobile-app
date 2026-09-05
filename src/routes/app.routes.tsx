import { createDrawerNavigator } from "@react-navigation/drawer";

import { Dimensions } from "react-native";
import { CustomDrawerContent, DrawerIcon } from "../components/CustomDrawer";
import { FazerPedido } from "../screens/FazerPedido";
import { Home } from "../screens/Home";
import { Last } from "../screens/Ultimas";
import { THEME } from "../theme";
import { Settings } from "../screens/Settings";
import { DICT } from "../i18n";
import { useUserSettings } from "../contexts/user/UserSettingsProvider";
import { HistoryType } from "../@types/history-type";

type HomeProps = Record<string, never>;
interface LastProps {
  historyType: HistoryType;
}
type FazerPedidoProps = Record<string, never>;
type SettingsProps = Record<string, never>;

export type RootStackParamList = {
  Home: HomeProps;
  LastRequested: LastProps;
  LastPlayed: LastProps;
  FazerPedido: FazerPedidoProps;
  Settings: SettingsProps;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

export function AppRoutes() {
  const { settings } = useUserSettings();

  return (
    <Navigator
      screenOptions={{
        headerShown: false,
        overlayColor: THEME.COLORS.OVERLAY,
        drawerStyle: {
          backgroundColor: THEME.COLORS.PRIMARY,
          width: Dimensions.get("window").width * 0.8,
        },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Screen
        options={{
          drawerLabel: DICT[settings.selectedLanguage].MENU_PLAYER,
          drawerIcon: ({ color }) => <DrawerIcon name="play-circle" color={color} />,
        }}
        name="Home"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: DICT[settings.selectedLanguage].MENU_LAST_REQUESTED,
          drawerIcon: ({ color }) => <DrawerIcon name="queue-music" color={color} />,
        }}
        name="LastRequested"
        component={Last}
        initialParams={{ historyType: "requests" }}
      />
      <Screen
        options={{
          drawerLabel: DICT[settings.selectedLanguage].MENU_LAST_PLAYED,
          drawerIcon: ({ color }) => <DrawerIcon name="history" color={color} />,
        }}
        name="LastPlayed"
        component={Last}
        initialParams={{ historyType: "played" }}
      />
      <Screen
        options={{
          drawerItemStyle: {
            display: "none",
          },
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
    </Navigator>
  );
}
