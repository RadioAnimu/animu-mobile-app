import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { MaskedValue } from "@/components/MaskedValue";
import { ProviderIcon } from "@/components/ProviderIcon";
import { providerLabel } from "@/constants/auth";
import type { AuthProfile, User } from "@/core/domain/user";
import { getUserName } from "@/core/domain/user";
import { useDict } from "@/hooks/useDict";
import { resolveMediaSource } from "@/utils/authImage";
import { maskEmail } from "@/utils/mask";
import { THEME } from "@/theme";
import { AVATAR, BADGE_SIZE, styles } from "@/screens/Account/styles";
import { ProfileBanner } from "@/screens/Account/ProfileBanner";

interface Props {
  user: User;
  profile: AuthProfile | null;
  /** Bumped on avatar/banner change to bust the image cache. */
  imageVersion: number;
  /** Locally saved banner (preferred over the remote URL). */
  bannerUri: string | null;
}

/** "22 Sep 2026" from a date-like value, or null when unavailable. */
function dateLabel(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MetaLine({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={styles.metaLine}>{children}</View>;
}

/**
 * 2015-Twitter profile header: a wide cover, a rounded-square avatar hanging
 * off its bottom-left, then the display name (verified badge inline), the
 * @handle beside it, then icon meta lines (last login, sign-in method).
 */
export function ProfileCard({ user, profile, imageVersion, bannerUri }: Readonly<Props>) {
  const dict = useDict();
  const profileUser = profile?.user ?? user;
  const name = getUserName({ handle: null, username: profileUser.username });
  const handle = profileUser.handle;
  const banner = profile?.banner;
  const loginProvider = profile?.session.loginProvider;
  const lastActivity = profile?.session.lastActivity;
  const lastLogin = dateLabel(
    lastActivity ? new Date(lastActivity * 1000) : null,
  );
  const bannerSource = resolveMediaSource(
    bannerUri,
    banner?.url,
    user.sessionToken,
    `banner-${imageVersion}`,
  );

  return (
    <View style={styles.card}>
      <ProfileBanner
        source={bannerSource}
        fallbackColor={banner?.color ?? THEME.COLORS.FRAME}
        revision={imageVersion}
      />
      <View style={styles.headerRow}>
        <View style={styles.identityRow}>
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
                {name}
              </Text>
              {profileUser.verified && (
                <View style={styles.badge}>
                  <Icon
                    name="verified"
                    size={BADGE_SIZE}
                    color={THEME.COLORS.BRAND}
                  />
                </View>
              )}
            </View>
            {handle && (
              <Text style={styles.handle} numberOfLines={1}>
                @{handle}
              </Text>
            )}
          </View>
        </View>

        {(profileUser.email || lastLogin || loginProvider) && (
          <View style={styles.meta}>
            {profileUser.email && (
              <MetaLine>
                <View style={styles.metaIcon}>
                  <Icon
                    name="mail-outline"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                </View>
                <MaskedValue
                  value={profileUser.email}
                  mask={maskEmail}
                  textStyle={styles.metaStrong}
                  showLabel={dict.ACCOUNT_SHOW}
                  hideLabel={dict.ACCOUNT_HIDE}
                  iconSize={14}
                />
              </MetaLine>
            )}
            {lastLogin && (
              <MetaLine>
                <View style={styles.metaIcon}>
                  <Icon
                    name="schedule"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                </View>
                <Text style={styles.metaText}>
                  {dict.ACCOUNT_LAST_LOGIN}
                  {" · "}
                  <Text style={styles.metaStrong}>{lastLogin}</Text>
                </Text>
              </MetaLine>
            )}
            {loginProvider && (
              <MetaLine>
                <View style={styles.metaIcon}>
                  <ProviderIcon
                    provider={loginProvider}
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.TEXT_DIM}
                  />
                </View>
                <Text style={styles.metaText}>
                  {dict.ACCOUNT_CONNECTED_VIA}
                  {" · "}
                  <Text style={styles.metaStrong}>
                    {providerLabel(loginProvider)}
                  </Text>
                </Text>
              </MetaLine>
            )}
          </View>
        )}
      </View>

      {!profileUser.verified && (
        <Text style={styles.verifiedInfo}>{dict.ACCOUNT_VERIFIED_INFO}</Text>
      )}
    </View>
  );
}
