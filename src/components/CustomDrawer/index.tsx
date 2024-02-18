import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import * as WebBrowser from "expo-web-browser";
import { version } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { THEME } from "../../theme";
WebBrowser.maybeCompleteAuthSession();

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const onLogin = async () => {
    await WebBrowser.openAuthSessionAsync(
      "https://discord.com/oauth2/authorize?client_id=1159273876732256266&redirect_uri=myapp://&response_type=code&scope=identify"
    );
  };

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
            source={require("../../assets/logo.png")}
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
        <TouchableOpacity
          onPress={onLogin}
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
