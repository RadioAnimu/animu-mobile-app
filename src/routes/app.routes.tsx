import { createDrawerNavigator } from "@react-navigation/drawer";

import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { CustomDrawerContent } from "../components/CustomDrawer";
import { FazerPedido } from "../screens/FazerPedido";
import { Home } from "../screens/Home";
import { Ultimas } from "../screens/Ultimas";
import { THEME } from "../theme";
import { Settings } from "../screens/Settings";
import { DICT, selectedLanguage } from "../languages";
import { useContext } from "react";
import { UserSettingsContext } from "../contexts/user.settings.context";

interface HomeProps {}
interface UltimasProps {
  type: "pedidas" | "tocadas";
}
interface FazerPedidoProps {}
interface SettingsProps {}

export type RootStackParamList = {
  Home: HomeProps;
  UltimasPedidas: UltimasProps;
  UltimasTocadas: UltimasProps;
  FazerPedido: FazerPedidoProps;
  Settings: SettingsProps;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

export function AppRoutes() {
  const { userSettings } = useContext(UserSettingsContext);

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
          drawerLabel: DICT[userSettings.selectedLanguage].MENU_LAST_REQUESTED,
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
        name="UltimasPedidas"
        component={Ultimas}
        initialParams={{ type: "pedidas" }}
      />
      <Screen
        options={{
          drawerLabel: DICT[userSettings.selectedLanguage].MENU_LAST_PLAYED,
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
        name="UltimasTocadas"
        component={Ultimas}
        initialParams={{ type: "tocadas" }}
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
