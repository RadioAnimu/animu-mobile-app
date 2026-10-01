import type { ComponentProps, JSX } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { CommonActions, DrawerActions } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { useDict } from "@/hooks/useDict";
import { emitReselect } from "@/core/navigation/reselect";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";
import { scale } from "@/theme/responsive";
import { styles } from "@/components/CustomDrawer/styles";

const MENU_ICON_SIZE = scale(22);
const SECTION_ICON_SIZE = scale(18);

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

interface SeparatorProps {
  sectionTitle?: string;
  /** Stable icon element for the section heading. */
  icon?: JSX.Element;
}

function Separator({ sectionTitle, icon }: SeparatorProps) {
  return (
    <View style={styles.section}>
      {icon}
      {sectionTitle && (
        <Text style={styles.sectionText}>{sectionTitle.toUpperCase()}</Text>
      )}
    </View>
  );
}

function NavItems({
  state,
  descriptors,
  navigation,
}: DrawerContentComponentProps) {
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
        const accent = focused ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT;

        const onPress = () => {
          haptics.select();
          // Re-tapping the screen already on top scrolls it to the top
          // instead of just closing the drawer.
          if (focused) emitReselect(route.name);
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
 * - Signed in: avatar + name + @handle + chevron (same shape as the Settings
 *   profile row); the whole chip opens Settings.
 * - Signed out: the chip opens Login and a separate gear opens Settings.
 */
function AccountRow({ onOpenLogin, onOpenSettings }: AccountRowProps) {
  const { user, profile } = useAuth();
  const dict = useDict();

  let caption = dict.SETTINGS_ACCOUNT_SIGN_IN;
  // The stored session can predate the provider handle; the profile is fresher.
  const handle = profile?.user.handle || user?.handle;
  if (user) {
    caption = handle ? `@${handle}` : dict.ACCOUNT_TITLE;
  }

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
              {user ? profile?.user.username || user.username : dict.LOGIN_WORD}
            </Text>
            <Text style={styles.accountCaption} numberOfLines={1}>
              {caption}
            </Text>
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
  const dict = useDict();
  const { navigation } = props;

  const goToSettings = () => {
    navigation.navigate("Settings");
  };

  const goToLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1 }}>
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
          >
            <Logo size={THEME.LAYOUT.LOGO_HEIGHT} />
          </TouchableOpacity>
        </View>

        <Separator
          icon={<DrawerIcon name="queue-music" size={SECTION_ICON_SIZE} />}
          sectionTitle={dict.MENU}
        />
        <NavItems {...props} />
      </View>

      <AccountRow onOpenLogin={goToLogin} onOpenSettings={goToSettings} />
    </DrawerContentScrollView>
  );
}
