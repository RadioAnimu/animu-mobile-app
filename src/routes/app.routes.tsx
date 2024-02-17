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
import { UltimasPedidas } from "../screens/UltimasPedidas";
import { UltimasTocadas } from "../screens/UltimasTocadas";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface HomeProps {}
interface UltimasPedidasProps {}
interface UltimasTocadasProps {}

export type RootStackParamList = {
  Home: HomeProps;
  UltimasPedidas: UltimasPedidasProps;
  UltimasTocadas: UltimasTocadasProps;
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
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            textAlign: "center",
            padding: 5,
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.MENU_ITEM,
          }}
        >
          Em construção
        </Text>
        {/*
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingHorizontal: 20,
            gap: 5,
          }}
        >
          <MaterialCommunityIcons
            name="discord"
            size={20}
            color={THEME.COLORS.SHAPE}
          />
          <Text
            style={{
              color: THEME.COLORS.SHAPE,
              textAlign: "center",
              fontFamily: THEME.FONT_FAMILY.BOLD,
              fontSize: THEME.FONT_SIZE.MENU_ITEM,
            }}
          >
            Login Discord
          </Text>
        </View>
        */}
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
    </Navigator>
  );
}
