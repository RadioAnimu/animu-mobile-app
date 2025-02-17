import {
  FontAwesome,
  FontAwesome5,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import * as Linking from "expo-linking";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { author } from "../../../package.json";
import { THEME } from "../../theme";
import { API } from "../../api";
import { DICT, IMGS } from "../../languages";
import { DiscordProfile } from "../DiscordProfile";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { useAuth } from "../../contexts/auth/AuthProvider";

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
  const { settings } = useUserSettings();
  const { user, login, logout, isLoading } = useAuth();

  return (
    <TouchableOpacity
      onPress={login}
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
        {DICT[settings.selectedLanguage].LOGIN_WORD} Discord
      </Text>
    </TouchableOpacity>
  );
}

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { settings } = useUserSettings();
  const { user } = useAuth();

  const LINKS: LinkMenuItemProps[] = [
    {
      title: DICT[settings.selectedLanguage].LINKS_WEBSITE,
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
      title: DICT[settings.selectedLanguage].LINKS_DISCORD,
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
            source={IMGS[settings.selectedLanguage].LOGO}
            style={{
              height: 100,
              alignSelf: "center",
              resizeMode: "contain",
            }}
          />
        </TouchableOpacity>
        {user?.sessionId ? (
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
            <DiscordProfile user={user} />
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
          sectionTile={DICT[settings.selectedLanguage].MENU}
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
          sectionTile={DICT[settings.selectedLanguage].LINKS}
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
          {DICT[settings.selectedLanguage].VERSION_TEXT}{" "}
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
