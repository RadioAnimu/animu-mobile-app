import { createDrawerNavigator } from "@react-navigation/drawer";

import { Dimensions } from "react-native";
import { CustomDrawerContent } from "../components/CustomDrawer";
import { FazerPedido } from "../screens/FazerPedido";
import { Home } from "../screens/Home";
import { UltimasPedidas } from "../screens/UltimasPedidas";
import { UltimasTocadas } from "../screens/UltimasTocadas";
import { THEME } from "../theme";

interface HomeProps {}
interface UltimasPedidasProps {}
interface UltimasTocadasProps {}
interface FazerPedidoProps {}

export type RootStackParamList = {
  Home: HomeProps;
  UltimasPedidas: UltimasPedidasProps;
  UltimasTocadas: UltimasTocadasProps;
  FazerPedido: FazerPedidoProps;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

export function AppRoutes() {
  return (
    <Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: THEME.COLORS.PRIMARY,
          width: Dimensions.get("window").width * 0.75, // 75% of the screen
        },
        drawerActiveTintColor: THEME.COLORS.WHITE_TEXT,
        drawerInactiveTintColor: THEME.COLORS.SHAPE,
        drawerLabelStyle: {
          fontFamily: THEME.FONT_FAMILY.BOLD,
          fontSize: THEME.FONT_SIZE.MENU_ITEM,
        },
        drawerItemStyle: {
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
          drawerLabel: "Últimas Pedidas",
        }}
        name="UltimasPedidas"
        component={UltimasPedidas}
      />
      <Screen
        options={{
          drawerLabel: "Últimas Tocadas",
        }}
        name="UltimasTocadas"
        component={UltimasTocadas}
      />
      <Screen
        options={{
          drawerLabel: "Fazer Pedido",
          drawerItemStyle: {
            display: "none",
          },
        }}
        name="FazerPedido"
        component={FazerPedido}
      />
    </Navigator>
  );
}
