import { createDrawerNavigator } from "@react-navigation/drawer";
import { Dimensions } from "react-native";
import { Home } from "../screens/Home";
import { THEME } from "../theme";
import { Image } from "react-native";

interface HomeProps {}

export type RootStackParamList = {
  Home: HomeProps;
  SaiJikkou: HomeProps;
  Programacao: HomeProps;
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
      }}
    >
      <Screen
        options={{
          drawerLabel: "Rádio Animu",
          drawerIcon: ({ focused, color, size }) => {
            return (
              <Image
                style={{ width: 24, height: 24 }}
                source={require("../assets/logo.png")}
              />
            );
          },
        }}
        name="Home"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: "Sai Jikkou!",
        }}
        name="SaiJikkou"
        component={Home}
      />
      <Screen
        options={{
          drawerLabel: "Programação",
        }}
        name="Programacao"
        component={Home}
      />
    </Navigator>
  );
}
