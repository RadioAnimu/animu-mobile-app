import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { MaskedValue } from "@/components/MaskedValue";
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
  /** Bumped on avatar change to bust the image cache. */
  imageVersion: number;
  /** Pulls the latest profile from the server. */
  onRefresh: () => void;
  refreshing: boolean;
}

/** The signed-in identity card: banner, avatar, name, badges and meta. */
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
  const banner = profile?.banner;
  const bannerSource = buildAuthImageSource(
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
      <View style={styles.identity}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user.avatarUrl} size={AVATAR} />
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {profileUser.email && (
            <MaskedValue
              value={profileUser.email}
              mask={maskEmail}
              textStyle={styles.caption}
              showLabel={dict.ACCOUNT_SHOW}
              hideLabel={dict.ACCOUNT_HIDE}
            />
          )}
          <View style={styles.badges}>
            <View
              style={[
                styles.badge,
                profileUser.verified ? styles.badgeSuccess : styles.badgeMuted,
              ]}
            >
              <MaterialIcons
                name={profileUser.verified ? "verified" : "info"}
                size={13}
                color={
                  profileUser.verified
                    ? THEME.COLORS.BRAND
                    : THEME.COLORS.TEXT_DIM
                }
              />
              <Text
                style={[
                  styles.badgeText,
                  profileUser.verified && styles.badgeTextSuccess,
                ]}
              >
                {profileUser.verified
                  ? dict.ACCOUNT_VERIFIED
                  : dict.ACCOUNT_NOT_VERIFIED}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Verified listeners need no explanation — the badge says it all. The
          paragraph is only the actionable "how to get verified" hint. */}
      {!profileUser.verified && (
        <Text style={styles.verifiedInfo}>{dict.ACCOUNT_VERIFIED_INFO}</Text>
      )}
    </View>
  );
}
