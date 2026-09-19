import type { ComponentProps, JSX } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
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
import { API } from "@/api";
import { Avatar } from "@/components/Avatar";
import { ProviderIcon } from "@/components/ProviderIcon";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { getUserName } from "@/core/domain/user";
import { providerLabel } from "@/constants/auth";
import { IMGS } from "@/i18n";
import { THEME } from "@/theme";
import { styles } from "@/components/CustomDrawer/styles";

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
      accessibilityRole="link"
      accessibilityLabel={title}
      activeOpacity={0.7}
      onPress={() => {
        void Linking.openURL(url).catch((error) =>
          console.warn("[Links] openURL failed:", error),
        );
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

interface AccountRowProps {
  onOpenLogin: () => void;
  onOpenSettings: () => void;
}

/**
 * Bottom identity block.
 *
 * - Signed in: avatar (brand ring) + name + sign-in method + chevron; the
 *   whole chip opens Settings.
 * - Signed out: the chip opens Login and a separate gear opens Settings.
 */
function AccountRow({ onOpenLogin, onOpenSettings }: AccountRowProps) {
  const { user, profile } = useAuth();
  const dict = useDict();
  const loginProvider = profile?.session.loginProvider;

  return (
    <View style={styles.bottom}>
      <View style={styles.accountRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityHint={
            user ? dict.A11Y_OPENS_SETTINGS : dict.A11Y_OPENS_LOGIN
          }
          activeOpacity={0.7}
          onPress={user ? onOpenSettings : onOpenLogin}
          style={[styles.accountIdentity, styles.accountIdentityGrow]}
        >
          {user ? (
            <Avatar uri={user.avatarUrl} style={styles.accountAvatar} />
          ) : (
            <View style={styles.accountIconBox}>
              <MaterialIcons
                name="login"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT}
              />
            </View>
          )}
          <View style={styles.accountText}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user ? getUserName(user) : dict.LOGIN_WORD}
            </Text>
            <View style={styles.accountService}>
              {user && (
                <ProviderIcon
                  provider={loginProvider ?? "animu"}
                  size={14}
                  color={THEME.COLORS.TEXT_DIM}
                />
              )}
              <Text style={styles.accountCaption} numberOfLines={1}>
                {user
                  ? loginProvider
                    ? `${dict.ACCOUNT_CONNECTED_VIA} ${providerLabel(loginProvider)}`
                    : dict.ACCOUNT_TITLE
                  : dict.SETTINGS_ACCOUNT_SIGN_IN}
              </Text>
            </View>
          </View>
          {user && (
            <MaterialIcons
              name="chevron-right"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          )}
        </TouchableOpacity>

        {/* Signed in, the identity chip itself opens Settings, so a separate
            gear would be redundant — it only earns its place when signed out. */}
        {!user && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityHint={dict.A11Y_OPENS_SETTINGS}
            accessibilityLabel={dict.SETTINGS_TITLE}
            activeOpacity={0.7}
            onPress={onOpenSettings}
            style={styles.gearButton}
          >
            <MaterialIcons
              name="settings"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { settings } = useUserSettings();
  const dict = useDict();
  const { navigation } = props;
  const [logoWidth, setLogoWidth] = useState(0);

  const goToSettings = () => {
    navigation.navigate("Settings");
  };

  const goToLogin = () => {
    navigation.navigate("Login");
  };

  const LINKS: LinkMenuItemProps[] = [
    {
      title: dict.LINKS_WEBSITE,
      url: API.WEB_URL,
      Icon: () => <DrawerIcon name="web" />,
    },
    {
      title: dict.LINKS_DISCORD,
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
            accessibilityRole="button"
            accessibilityLabel="Animu"
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
          sectionTile={dict.MENU}
        />
        <NavItems {...props} />

        <Separator
          Icon={() => <DrawerIcon name="link" size={SECTION_ICON_SIZE} />}
          sectionTile={dict.LINKS}
        />
        {LINKS.map((link) => (
          <LinkMenuItem
            key={link.title}
            Icon={link.Icon}
            title={link.title}
            url={link.url}
          />
        ))}
      </View>

      <AccountRow onOpenLogin={goToLogin} onOpenSettings={goToSettings} />
    </DrawerContentScrollView>
  );
}
