import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
  createDrawerNavigator,
} from "@react-navigation/drawer";
import { Dimensions, Image, Text, TouchableOpacity, View } from "react-native";
import { Home } from "../screens/Home";
import { THEME } from "../theme";
import { version } from "../../package.json";

interface HomeProps {}

export type RootStackParamList = {
  Home: HomeProps;
  SaiJikkou: HomeProps;
  Programacao: HomeProps;
};

const { Navigator, Screen } = createDrawerNavigator<RootStackParamList>();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        justifyContent: "space-between",
        alignContent: "center",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <View>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("Home");
          }}
        >
          <Image
            source={require("../assets/logo.png")}
            style={{
              height: 100,
              alignSelf: "center",
              resizeMode: "contain",
            }}
          />
        </TouchableOpacity>
        <DrawerItemList {...props} />
      </View>
      <View
        style={{
          marginBottom: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            textAlign: "center",
            padding: 5,
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.FOOTER,
          }}
        >
          Versão v{version} - Desenvolvido com muito ❤️ por Ness.js
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}

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
          drawerLabel: "Programação",
        }}
        name="Programacao"
        component={Home}
      />
    </Navigator>
  );
}
