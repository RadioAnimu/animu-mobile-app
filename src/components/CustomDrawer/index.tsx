import type { ComponentProps, JSX } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import {
  CommonActions,
  DrawerActions,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { author } from "../../../package.json";
import { API } from "../../api";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { DICT, IMGS } from "../../i18n";
import { THEME } from "../../theme";
import { DiscordProfile } from "../DiscordProfile";
import { styles } from "./styles";

export const MENU_ICON_SIZE = 22;
const SECTION_ICON_SIZE = 18;
const TEXT_MUTED = "rgba(255, 255, 255, 0.7)";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface DrawerIconProps {
  name: MaterialIconName;
  size?: number;
  color?: string;
}

export function DrawerIcon({
  name,
  size = MENU_ICON_SIZE,
  color = THEME.COLORS.WHITE_TEXT,
}: DrawerIconProps) {
  return (
    <View style={styles.iconBox}>
      <MaterialIcons name={name} size={size} color={color} />
    </View>
  );
}

export interface SeparatorProps {
  sectionTile?: string;
  Icon?: () => JSX.Element;
}

export function Separator({ sectionTile, Icon }: SeparatorProps) {
  return (
    <View style={styles.section}>
      {Icon && <Icon />}
      {sectionTile && (
        <Text style={styles.sectionText}>{sectionTile.toUpperCase()}</Text>
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
      activeOpacity={0.7}
      onPress={() => {
        Linking.openURL(url);
      }}
      style={styles.navItem}
    >
      {Icon && <Icon />}
      <Text style={styles.navItemText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function LoginComponent() {
  const { settings } = useUserSettings();
  const { login } = useAuth();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={login}
      style={styles.loginButton}
    >
      <DrawerIcon name="discord" />
      <Text style={styles.navItemText}>
        {DICT[settings.selectedLanguage].LOGIN_WORD} Discord
      </Text>
    </TouchableOpacity>
  );
}

function NavItems({ state, descriptors, navigation }: DrawerContentComponentProps) {
  return (
    <View>
      {state.routes.map((route) => {
        const { options } = descriptors[route.key];
        const itemStyle = StyleSheet.flatten(options.drawerItemStyle);
        if (itemStyle?.display === "none") return null;

        const focused = state.routes[state.index]?.key === route.key;
        const label =
          typeof options.drawerLabel === "string"
            ? options.drawerLabel
            : (options.title ?? route.name);

        const onPress = () => {
          navigation.dispatch({
            ...(focused
              ? DrawerActions.closeDrawer()
              : CommonActions.navigate(route.name, route.params)),
            target: state.key,
          });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            activeOpacity={0.7}
            onPress={onPress}
            style={[styles.navItem, focused && styles.navItemFocused]}
          >
            {options.drawerIcon?.({
              color: focused ? THEME.COLORS.WHITE_TEXT : TEXT_MUTED,
              focused,
              size: MENU_ICON_SIZE,
            })}
            <Text style={styles.navItemText}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { settings } = useUserSettings();
  const { user } = useAuth();
  const { navigation } = props;

  const goToSettings = () => {
    navigation.navigate("Settings");
  };

  const LINKS: LinkMenuItemProps[] = [
    {
      title: DICT[settings.selectedLanguage].LINKS_WEBSITE,
      url: API.WEB_URL,
      Icon: () => <DrawerIcon name="web" />,
    },
    {
      title: DICT[settings.selectedLanguage].LINKS_DISCORD,
      url: API.DISCORD_URL,
      Icon: () => <DrawerIcon name="discord" />,
    },
  ];

  const goToNessSocial = () => {
    Linking.openURL("https://x.com/rmotafreitas");
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "space-between",
      }}
    >
      <View>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate("Home");
            }}
            style={styles.logoButton}
          >
            <Image
              source={IMGS[settings.selectedLanguage].LOGO}
              style={styles.logo}
            />
          </TouchableOpacity>

          {user?.sessionId ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goToSettings}
              style={styles.headerCard}
            >
              <View style={styles.headerRow}>
                <DiscordProfile user={user} />
              </View>
              <DrawerIcon name="settings" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerCard}>
              <LoginComponent />
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={4}
                onPress={goToSettings}
                style={styles.settingsButton}
              >
                <DrawerIcon name="settings" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Separator
          Icon={() => <DrawerIcon name="queue-music" size={SECTION_ICON_SIZE} />}
          sectionTile={DICT[settings.selectedLanguage].MENU}
        />
        <NavItems {...props} />

        <Separator
          Icon={() => <DrawerIcon name="link" size={SECTION_ICON_SIZE} />}
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
        activeOpacity={0.7}
        onPress={goToNessSocial}
        style={styles.footer}
      >
        <Text style={styles.footerText}>
          {DICT[settings.selectedLanguage].VERSION_TEXT}{" "}
          <Text style={styles.footerAuthor}>@{author}</Text>
        </Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}
