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
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { API } from "../../api";
import { useAuth } from "../../contexts/auth/AuthProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { DICT, IMGS } from "../../i18n";
import { THEME } from "../../theme";
import { styles } from "./styles";

export const MENU_ICON_SIZE = 22;
const SECTION_ICON_SIZE = 18;

/** Intrinsic ratio of the logo assets (1200×630 px). */
const LOGO_ASPECT_RATIO = 1200 / 630;

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface DrawerIconProps {
  name: MaterialIconName;
  size?: number;
  color?: string;
}

export function DrawerIcon({
  name,
  size = MENU_ICON_SIZE,
  color = THEME.COLORS.TEXT,
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
        void Linking.openURL(url);
      }}
      style={styles.navItem}
    >
      {Icon && <Icon />}
      <Text style={styles.navItemText}>{title}</Text>
      <MaterialIcons
        name="open-in-new"
        size={16}
        color={THEME.COLORS.TEXT_DIM}
      />
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
        const accent = focused ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT_SOFT;

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
              color: accent,
              focused,
              size: MENU_ICON_SIZE,
            })}
            <Text
              style={[styles.navItemText, focused && styles.navItemTextFocused]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * State-of-the-art drawer pattern (YouTube Music / Telegram): identity lives
 * at the bottom as a plain nav-grade row — avatar + name + chevron into
 * Settings; before login it starts the Discord flow directly.
 */
function AccountRow({ onPress }: { onPress: () => void }) {
  const { settings } = useUserSettings();
  const { user, login } = useAuth();

  return (
    <View style={styles.bottom}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityHint="Opens settings"
        activeOpacity={0.7}
        onPress={user?.sessionId ? onPress : login}
        style={styles.accountRow}
      >
        {user?.sessionId ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={styles.accountAvatar}
          />
        ) : (
          <View style={styles.accountIconBox}>
            <MaterialIcons
              name="discord"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </View>
        )}
        <Text style={styles.accountName}>
          {user?.sessionId
            ? user.nickname || user.username
            : `${DICT[settings.selectedLanguage].LOGIN_WORD} Discord`}
        </Text>
        <MaterialIcons
          name="chevron-right"
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </TouchableOpacity>
    </View>
  );
}

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { settings } = useUserSettings();
  const { navigation } = props;
  const [logoWidth, setLogoWidth] = useState(0);

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

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate("Home");
            }}
            style={styles.logoButton}
            onLayout={(event) => {
              setLogoWidth(event.nativeEvent.layout.width);
            }}
          >
            <Image
              source={IMGS[settings.selectedLanguage].LOGO}
              style={[styles.logo, logoWidth > 0 && { height: logoWidth / LOGO_ASPECT_RATIO }]}
            />
          </TouchableOpacity>
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

      <AccountRow onPress={goToSettings} />
    </DrawerContentScrollView>
  );
}
