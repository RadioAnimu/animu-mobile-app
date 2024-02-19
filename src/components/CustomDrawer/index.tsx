import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useContext } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { version } from "../../../package.json";
import { DiscordUser, UserContext } from "../../contexts/user.context";
import { THEME } from "../../theme";

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const userContext = useContext(UserContext);

  const onLogin = async () => {
    const callbackUrl = Linking.createURL("redirect", { scheme: "animuapp" });

    const result = await WebBrowser.openAuthSessionAsync(
      "https://discord.com/api/oauth2/authorize?client_id=1159273876732256266&response_type=code&redirect_uri=https%3A%2F%2Fwww.animu.com.br%2Fteste%2Fprocess-oauth-mobile.php&scope=identify",
      callbackUrl
    );

    if (result.type === "success") {
      const data = Linking.parse(result.url);
      console.log({ data });
      if (data.queryParams?.user) {
        const userString = decodeURIComponent(data.queryParams.user.toString());
        const user: DiscordUser = JSON.parse(userString);
        if (userContext) {
          userContext.setUser(user);
          await AsyncStorage.setItem("user", userString);
        }
      }
    }
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
        {userContext?.user ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              padding: 10,
            }}
          >
            <Image
              source={{
                uri: userContext.user.avatar_url,
              }}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
              }}
            />
            <Text
              style={{
                color: THEME.COLORS.WHITE_TEXT,
                textAlign: "center",
                padding: 5,
                fontFamily: THEME.FONT_FAMILY.BOLD,
                fontSize: THEME.FONT_SIZE.MENU_ITEM,
              }}
            >
              {userContext.user.nickname || userContext.user.username}
            </Text>
          </View>
        ) : (
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
        )}
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
