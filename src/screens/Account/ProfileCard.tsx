import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { MaskedValue } from "@/components/MaskedValue";
import { ProviderIcon } from "@/components/ProviderIcon";
import { providerLabel } from "@/constants/auth";
import type { AuthProfile, User } from "@/core/domain/user";
import { getUserName } from "@/core/domain/user";
import { useDict } from "@/hooks/useDict";
import { buildAuthImageSource } from "@/utils/authImage";
import { maskEmail } from "@/utils/mask";
import { THEME } from "@/theme";
import { AVATAR, styles } from "@/screens/Account/styles";
import { ProfileBanner } from "@/screens/Account/ProfileBanner";

interface Props {
  user: User;
  profile: AuthProfile | null;
  /** Bumped on avatar/banner change to bust the image cache. */
  imageVersion: number;
  /** Pulls the latest profile from the server. */
  onRefresh: () => void;
  refreshing: boolean;
}

/** "22 Sep 2026" from an epoch-seconds value, or null when unavailable. */
function lastLoginLabel(
  epochSeconds: number | null | undefined,
): string | null {
  if (!epochSeconds) return null;
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Twitter-style profile header, matching the classic header-photo layout:
 * a wide cover, then the avatar below its left edge with the display name and
 * handle beside it, and a left-aligned stats strip (label over value) under
 * the whole block.
 */
export function ProfileCard({
  user,
  profile,
  imageVersion,
  onRefresh,
  refreshing,
}: Props) {
  const dict = useDict();
  const profileUser = profile?.user ?? user;
  const name = getUserName(profileUser);
  const handle = profileUser.handle;
  const banner = profile?.banner;
  const loginProvider = profile?.session.loginProvider;
  const lastLogin = lastLoginLabel(profile?.session.lastActivity);
  const bannerSource = buildAuthImageSource(
    banner?.url,
    user.sessionToken,
    `banner-${imageVersion}`,
  );

  // One identity line: the @handle when there is one, otherwise the display
  // name. Never both — they are usually the same string.
  const identity = handle ? `@${handle}` : name;

  return (
    <View style={styles.card}>
      <ProfileBanner
        source={bannerSource}
        fallbackColor={banner?.color ?? THEME.COLORS.FRAME}
        revision={imageVersion}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={dict.ACCOUNT_REFRESH}
        activeOpacity={0.7}
        disabled={refreshing}
        hitSlop={8}
        onPress={onRefresh}
        style={[styles.refreshButton, refreshing && styles.refreshButtonBusy]}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={THEME.COLORS.TEXT} />
        ) : (
          <MaterialIcons
            name="sync"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT}
          />
        )}
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            uri={user.avatarUrl}
            size={AVATAR}
            style={styles.avatar}
            iconSize={AVATAR * 0.55}
          />
        </View>
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {identity}
            </Text>
            {profileUser.verified && (
              <MaterialIcons
                name="verified"
                size={THEME.ICON.MD}
                color={THEME.COLORS.BRAND}
              />
            )}
          </View>
          {profileUser.email && (
            <MaskedValue
              value={profileUser.email}
              mask={maskEmail}
              textStyle={styles.caption}
              showLabel={dict.ACCOUNT_SHOW}
              hideLabel={dict.ACCOUNT_HIDE}
              iconSize={14}
            />
          )}
        </View>
      </View>

      {!profileUser.verified && (
        <Text style={styles.verifiedInfo}>{dict.ACCOUNT_VERIFIED_INFO}</Text>
      )}

      <View style={styles.stats}>
        {lastLogin && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{dict.ACCOUNT_LAST_LOGIN}</Text>
            <Text style={styles.statValue}>{lastLogin}</Text>
          </View>
        )}
        {loginProvider && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{dict.ACCOUNT_CONNECTED_VIA}</Text>
            <View style={styles.statValueRow}>
              <ProviderIcon
                provider={loginProvider}
                size={THEME.ICON.MD}
                color={THEME.COLORS.TEXT_SOFT}
              />
              <Text style={styles.statValue}>
                {providerLabel(loginProvider)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
