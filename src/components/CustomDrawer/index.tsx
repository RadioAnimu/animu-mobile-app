import {
  FontAwesome,
  FontAwesome5,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
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
import { author } from "../../../package.json";
import { DiscordUser, UserContext } from "../../contexts/user.context";
import { THEME } from "../../theme";
import { API } from "../../api";
import { DICT, IMGS, LANGS_KEY_VALUE_PAIRS } from "../../languages";
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { DiscordProfile } from "../DiscordProfile";

export const checkIfUserIsStillInTheServerAndIfYesExtendSession: (
  user: DiscordUser
) => Promise<boolean> = async (user: DiscordUser) => {
  const { PHPSESSID } = user;
  const url =
    "https://www.animu.com.br/teste/chatIsThisReal.php?PHPSESSID=" + PHPSESSID;
  const response = await fetch(url);
  const data = await response.text();
  return data === "1";
};

export const logoutUserFromTheServer: (
  user: DiscordUser
) => Promise<boolean> = async (user: DiscordUser) => {
  const { PHPSESSID } = user;
  const url =
    "https://www.animu.com.br/teste/byeChat.php?PHPSESSID=" + PHPSESSID;
  const response = await fetch(url);
  const data = await response.text();
  return data === "1";
};

export interface SeparatorProps {
  sectionTile?: string;
  Icon?: () => JSX.Element;
}

export function Separator({ sectionTile, Icon }: SeparatorProps) {
  return (
    <View
      style={{
        borderBottomColor: THEME.COLORS.WHITE_TEXT,
        borderBottomWidth: 2,
        padding: 10,
        width: "90%",
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 10,
        marginTop: 10,
        marginBottom: 5,
      }}
    >
      {Icon && <Icon />}
      {sectionTile && (
        <Text
          style={{
            color: THEME.COLORS.WHITE_TEXT,
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.MENU_ITEM,
          }}
        >
          {sectionTile}
        </Text>
      )}
    </View>
  );
}

export interface LinkMenuItemProps {
  Icon?: () => JSX.Element;
  title: string;
  url: string;
}

export function LinkMenuItem({ Icon, title, url }: LinkMenuItemProps) {
  return (
    <TouchableOpacity
      onPress={() => {
        Linking.openURL(url);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 5,
        marginBottom: 2,
      }}
    >
      {Icon && <Icon />}
      <Text
        style={{
          color: THEME.COLORS.WHITE_TEXT,
          textAlign: "center",
          fontFamily: THEME.FONT_FAMILY.BOLD,
          fontSize: THEME.FONT_SIZE.MENU_ITEM,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function LoginComponent() {
  const { userSettings } = useContext(UserSettingsContext);
  const userContext = useContext(UserContext);

  const onLogin = async () => {
    const callbackUrl = Linking.createURL("redirect", { scheme: "animuapp" });

    const result = await WebBrowser.openAuthSessionAsync(
      "https://discord.com/api/oauth2/authorize?client_id=1159273876732256266&response_type=code&redirect_uri=https%3A%2F%2Fwww.animu.com.br%2Fteste%2Fprocess-oauth-mobile.php&scope=identify",
      callbackUrl
    );

    if (result.type === "success") {
      const data = Linking.parse(result.url);
      if (data.queryParams?.user) {
        const userString = decodeURIComponent(data.queryParams.user.toString());
        const user: DiscordUser = JSON.parse(userString);
        const PHPSESSID = data.queryParams.PHPSESSID?.toString();
        if (PHPSESSID) {
          user.PHPSESSID = PHPSESSID;
        }
        if (userContext) {
          userContext.setUser(user);
          await AsyncStorage.setItem("user", JSON.stringify(user));
        }
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={onLogin}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 5,
        marginVertical: 10,
      }}
    >
      <MaterialCommunityIcons
        name="discord"
        size={THEME.FONT_SIZE.MENU_ITEM}
        color={THEME.COLORS.WHITE_TEXT}
      />
      <Text
        style={{
          color: THEME.COLORS.WHITE_TEXT,
          textAlign: "center",
          fontFamily: THEME.FONT_FAMILY.BOLD,
          fontSize: THEME.FONT_SIZE.MENU_ITEM,
        }}
      >
        {DICT[userSettings.selectedLanguage].LOGIN_WORD} Discord
      </Text>
    </TouchableOpacity>
  );
}

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { userSettings } = useContext(UserSettingsContext);

  const LINKS: LinkMenuItemProps[] = [
    {
      title: DICT[userSettings.selectedLanguage].LINKS_WEBSITE,
      url: API.WEB_URL,
      Icon: () => (
        <FontAwesome5
          name="globe"
          size={THEME.FONT_SIZE.MENU_ITEM}
          color={THEME.COLORS.WHITE_TEXT}
        />
      ),
    },
    {
      title: DICT[userSettings.selectedLanguage].LINKS_DISCORD,
      url: API.DISCORD_URL,
      Icon: () => (
        <FontAwesome5
          name="discord"
          size={THEME.FONT_SIZE.MENU_ITEM}
          color={THEME.COLORS.WHITE_TEXT}
        />
      ),
    },
  ];

  const userContext = useContext(UserContext);

  const goToNessSocial = () => {
    Linking.openURL("https://x.com/rmotafreitas");
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
            source={IMGS[userSettings.selectedLanguage].LOGO}
            style={{
              height: 100,
              alignSelf: "center",
              resizeMode: "contain",
            }}
          />
        </TouchableOpacity>
        {userContext?.user ? (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("Settings");
            }}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "90%",
              alignSelf: "center",
            }}
          >
            <DiscordProfile user={userContext.user} />
            <FontAwesome
              name="gear"
              size={THEME.FONT_SIZE.MENU_ITEM}
              color={THEME.COLORS.WHITE_TEXT}
              style={{
                marginLeft: "auto",
              }}
            />
          </TouchableOpacity>
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "90%",
              alignSelf: "center",
            }}
          >
            <LoginComponent />
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("Settings");
              }}
            >
              <FontAwesome
                name="gear"
                size={THEME.FONT_SIZE.MENU_ITEM}
                color={THEME.COLORS.WHITE_TEXT}
                style={{
                  marginLeft: "auto",
                }}
              />
            </TouchableOpacity>
          </View>
        )}
        <Separator
          Icon={() => (
            <FontAwesome5
              name="bars"
              size={THEME.FONT_SIZE.MENU_ITEM}
              color={THEME.COLORS.WHITE_TEXT}
            />
          )}
          sectionTile={DICT[userSettings.selectedLanguage].MENU}
        />
        <DrawerItemList {...props} />
        <Separator
          Icon={() => (
            <FontAwesome5
              name="link"
              size={THEME.FONT_SIZE.MENU_ITEM}
              color={THEME.COLORS.WHITE_TEXT}
            />
          )}
          sectionTile={DICT[userSettings.selectedLanguage].LINKS}
        />
        {LINKS.map((link, index) => (
          <LinkMenuItem
            key={index}
            Icon={link.Icon}
            title={link.title}
            url={link.url}
          />
        ))}
      </View>
      <TouchableOpacity
        onPress={goToNessSocial}
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
            width: "90%",
            fontFamily: THEME.FONT_FAMILY.BOLD,
            fontSize: THEME.FONT_SIZE.FOOTER,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {DICT[userSettings.selectedLanguage].VERSION_TEXT}{" "}
          <Text
            style={{
              textDecorationLine: "underline",
            }}
          >
            @{author}
          </Text>
        </Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}
