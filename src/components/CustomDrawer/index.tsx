import type { ComponentProps, JSX } from "react";
import { Icon } from "@/components/Icon";
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  useDrawerStatus,
} from "@react-navigation/drawer";
import { CommonActions, DrawerActions } from "@react-navigation/native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { WINDOW_CONTROLS_HEIGHT } from "@/theme/layout";
import { useAlert } from "@/contexts/alert/AlertProvider";
import { useAuth } from "@/contexts/auth/AuthProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { emitReselect } from "@/core/navigation/reselect";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";
import { styles } from "@/components/CustomDrawer/styles";

const MENU_ICON_SIZE = THEME.ICON.MD;
const SECTION_ICON_SIZE = THEME.ICON.SECTION;

/**
 * The drawer stays mounted while closed, parked off-screen by a transform
 * that Android's D-pad focus search does not see: its controls would be
 * focus targets beside the header's menu button (a keyboard or D-pad on a
 * tablet). They are focusable — and accessible: Android makes every
 * accessible view focusable, and an off-screen menu has nothing to read —
 * only while the drawer is open, and opening it puts focus on the current
 * destination.
 */
const useDrawerOpen = () => useDrawerStatus() === "open";
/** The drawer logo's size in a short (landscape phone) window. */
const SHORT_LOGO_RATIO = 0.55;

/** Routes unavailable while a live DJ is on air (requests go via the live sheet). */
const LIVE_LOCKED_ROUTES = new Set(["MakeRequest"]);

type MaterialIconName = ComponentProps<typeof Icon>["name"];

interface DrawerIconProps {
  name: MaterialIconName;
  size?: number;
  color?: string;
}

export function DrawerIcon({
  name,
  size = MENU_ICON_SIZE,
  color = THEME.COLORS.TEXT,
}: Readonly<DrawerIconProps>) {
  return (
    <View style={styles.iconBox}>
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

interface SeparatorProps {
  sectionTitle?: string;
  /** Stable icon element for the section heading. */
  icon?: JSX.Element;
}

function Separator({ sectionTitle, icon }: Readonly<SeparatorProps>) {
  return (
    <View style={styles.section}>
      {icon}
      {sectionTitle && (
        <Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
          style={styles.sectionText}
        >
          {sectionTitle.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function NavItems({
  state,
  descriptors,
  navigation,
}: Readonly<DrawerContentComponentProps>) {
  const dict = useDict();
  const { toast } = useAlert();
  const { currentProgram } = usePlayer();
  const isLive = Boolean(currentProgram?.isLive);
  const open = useDrawerOpen();

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

        const locked = isLive && LIVE_LOCKED_ROUTES.has(route.name);

        const onPress = () => {
          if (locked) {
            haptics.error();
            toast(dict.REQUEST_ERROR_ONAIR, "error");
            return;
          }
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
            accessible={open}
            focusable={open}
            hasTVPreferredFocus={open && focused}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused, disabled: locked }}
            activeOpacity={THEME.OPACITY.PRESSED}
            onPress={onPress}
            style={[
              styles.navItem,
              focused && styles.navItemFocused,
              locked && styles.navItemLocked,
            ]}
          >
            {options.drawerIcon?.({
              color: accent,
              focused,
              size: MENU_ICON_SIZE,
            })}
            <Text
              maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
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
  onOpenAccount: () => void;
  onOpenSettings: () => void;
}

/**
 * Bottom identity block.
 *
 * - Signed in: avatar + name + @handle + chevron (same shape as the Settings
 *   profile row); the whole chip opens Account, like that row does.
 * - Signed out: the chip opens Login.
 * - Both: a separate gear opens Settings, so it is always one visible tap away.
 */
function AccountRow({ onOpenLogin, onOpenAccount, onOpenSettings }: Readonly<AccountRowProps>) {
  const { user, profile } = useAuth();
  const dict = useDict();
  const open = useDrawerOpen();

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
          accessible={open}
          focusable={open}
          accessibilityRole="button"
          accessibilityLabel={
            user
              ? [profile?.user.username || user.username, caption].join(", ")
              : dict.ACCOUNT_SIGN_IN
          }
          accessibilityHint={
            user ? dict.A11Y_OPENS_ACCOUNT : dict.A11Y_OPENS_LOGIN
          }
          activeOpacity={THEME.OPACITY.PRESSED}
          onPress={user ? onOpenAccount : onOpenLogin}
          style={[styles.accountIdentity, styles.accountIdentityGrow]}
        >
          {user ? (
            <Avatar uri={user.avatarUrl} style={styles.accountAvatar} />
          ) : (
            <View style={styles.accountIconBox}>
              <Icon
                name="login"
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT}
              />
            </View>
          )}
          <View style={styles.accountText}>
            <Text
              maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
              style={styles.accountName}
              numberOfLines={1}
            >
              {user ? profile?.user.username || user.username : dict.ACCOUNT_SIGN_IN}
            </Text>
            <Text
              maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
              style={styles.accountCaption}
              numberOfLines={1}
            >
              {caption}
            </Text>
          </View>
          {user && (
            <Icon
              name="chevron-right"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT_DIM}
            />
          )}
        </TouchableOpacity>

        {/* Always visible: the chip is identity (Account or Login), so the
            gear is the one way into Settings. */}
        <TouchableOpacity
          accessible={open}
          focusable={open}
          accessibilityRole="button"
          accessibilityHint={dict.A11Y_OPENS_SETTINGS}
          accessibilityLabel={dict.SETTINGS_TITLE}
          activeOpacity={THEME.OPACITY.PRESSED}
          onPress={onOpenSettings}
          style={styles.gearButton}
        >
          <Icon
            name="settings"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CustomDrawerContent(props: Readonly<DrawerContentComponentProps>) {
  const dict = useDict();
  const { navigation } = props;
  const insets = useSafeAreaInsets();
  const { short, windowControlsInset } = useResponsiveLayout();
  const open = useDrawerOpen();

  // Detail pages push over the drawer; close it underneath so popping back
  // lands on the screen, not on a still-open menu.
  const goToSettings = () => {
    navigation.closeDrawer();
    navigation.navigate("Settings");
  };

  const goToLogin = () => {
    navigation.closeDrawer();
    navigation.navigate("Login");
  };

  const goToAccount = () => {
    navigation.closeDrawer();
    navigation.navigate("Account");
  };

  return (
    // The drawer surface runs edge-to-edge on the left, so in landscape the
    // notch would clip the rows: the content is padded by the side inset. A
    // portrait phone reports 0 for both, so nothing moves there; the
    // scroll view itself already scrolls the menu in short windows.
    <DrawerContentScrollView
      {...props}
      // Android makes a scroll view focusable exactly when it scrolls: closed,
      // the off-screen menu must not be a D-pad stop.
      scrollEnabled={open}
      contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left }}
    >
      <View>
        {/* In an iPadOS window the system's window controls cover the
            drawer's top-leading corner: the logo drops below them. */}
        <View style={[styles.header, windowControlsInset > 0 && { marginTop: WINDOW_CONTROLS_HEIGHT }]}>
          <TouchableOpacity
            accessible={open}
            focusable={open}
            accessibilityRole="button"
            accessibilityLabel="Animu"
            activeOpacity={THEME.OPACITY.PRESSED}
            onPress={() => {
              navigation.navigate("Home");
            }}
            style={styles.logoButton}
          >
            {/* A landscape phone gives the menu ~390pt of height: a smaller
                logo leaves the destinations on the first screen. */}
            <Logo size={short ? THEME.LAYOUT.LOGO_HEIGHT * SHORT_LOGO_RATIO : THEME.LAYOUT.LOGO_HEIGHT} />
          </TouchableOpacity>
        </View>

        <Separator
          icon={<DrawerIcon name="menu" size={SECTION_ICON_SIZE} />}
          sectionTitle={dict.MENU}
        />
        <NavItems {...props} />
      </View>

      <AccountRow
        onOpenLogin={goToLogin}
        onOpenAccount={goToAccount}
        onOpenSettings={goToSettings}
      />
    </DrawerContentScrollView>
  );
}
