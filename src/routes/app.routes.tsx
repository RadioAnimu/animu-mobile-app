import { createDrawerNavigator } from "@react-navigation/drawer";

import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { CustomDrawerContent } from "../components/CustomDrawer";
import { FazerPedido } from "../screens/FazerPedido";
import { Home } from "../screens/Home";
import { Last } from "../screens/Ultimas";
import { THEME } from "../theme";
import { Settings } from "../screens/Settings";
import { DICT } from "../languages";
import { useUserSettings } from "../contexts/user/UserSettingsProvider";
import { HistoryType } from "../@types/history-type";

interface HomeProps {}
interface LastProps {
  historyType: HistoryType;
}
interface FazerPedidoProps {}
interface SettingsProps {}

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
        drawerStyle: {
          backgroundColor: THEME.COLORS.PRIMARY,
          width: Dimensions.get("window").width * 0.8, // 75% of the screen
        },
        drawerActiveTintColor: THEME.COLORS.WHITE_TEXT,
        drawerInactiveTintColor: THEME.COLORS.WHITE_TEXT,
        drawerLabelStyle: {
          fontFamily: THEME.FONT_FAMILY.BOLD,
          fontSize: THEME.FONT_SIZE.MENU_ITEM,
          textAlign: "left",
          width: Dimensions.get("window").width * 0.64,
        },
        drawerItemStyle: {
          marginVertical: 0,
          marginHorizontal: 10,
          borderRadius: 10,
        },
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      <Screen
        options={{
          drawerLabel: "Player",
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="Home"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: DICT[settings.selectedLanguage].MENU_LAST_REQUESTED,
          drawerIcon: () => {
            return (
              <MaterialIcons
                name="queue-music"
                size={25}
                color={THEME.COLORS.WHITE_TEXT}
                style={{
                  marginRight: -30,
                }}
              />
            );
          },
        }}
        name="LastRequested"
        component={Last}
        initialParams={{ historyType: "requests" }}
      />
      <Screen
        options={{
          drawerLabel: DICT[settings.selectedLanguage].MENU_LAST_PLAYED,
          drawerIcon: () => {
            return (
              <FontAwesome5
                name="history"
                size={20}
                color={THEME.COLORS.WHITE_TEXT}
                style={{
                  marginRight: -24,
                }}
              />
            );
          },
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
