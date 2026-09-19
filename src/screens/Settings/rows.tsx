import { useEffect, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Animated, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { ProviderIcon } from "@/components/ProviderIcon";
import { THEME } from "@/theme";
import type { Dict } from "@/i18n";
import { getUserName } from "@/core/domain/user";
import type { AuthProfile, User } from "@/core/domain/user";
import { providerLabel } from "@/constants/auth";
import { styles, SWITCH } from "@/screens/Settings/styles";
import { haptics } from "@/utils/haptics";

export function Divider() {
  return <View style={styles.divider} />;
}

interface AccountRowProps {
  user: User | null;
  profile: AuthProfile | null;
  dict: Dict;
  onPress: () => void;
}

export function AccountRow({ user, profile, dict, onPress }: AccountRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.row, styles.accountRow]}
    >
      {user ? (
        <>
          <Avatar uri={user.avatarUrl} style={styles.accountAvatar} />
          <View style={styles.accountInfo}>
            <View style={styles.accountNameRow}>
              <Text style={styles.accountName} numberOfLines={1}>
                {getUserName(user)}
              </Text>
              {profile?.user.verified && (
                <MaterialIcons
                  name="verified"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.BRAND}
                />
              )}
            </View>
            <View style={styles.accountService}>
              <ProviderIcon
                provider={profile?.session.loginProvider ?? "animu"}
                size={14}
                color={THEME.COLORS.TEXT_DIM}
              />
              <Text style={styles.accountCaption}>
                {profile?.session.loginProvider
                  ? `${dict.ACCOUNT_CONNECTED_VIA} ${providerLabel(
                      profile.session.loginProvider,
                    )}`
                  : dict.ACCOUNT_TITLE}
              </Text>
            </View>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
        </>
      ) : (
        <>
          <View style={styles.accountServiceIcon}>
            <MaterialIcons
              name="login"
              size={THEME.ICON.MD}
              color={THEME.COLORS.TEXT}
            />
          </View>
          <Text style={styles.rowLabel}>{dict.SETTINGS_ACCOUNT_SIGN_IN}</Text>
          <MaterialIcons
            name="chevron-right"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
        </>
      )}
    </TouchableOpacity>
  );
}

interface SwitchProps {
  value: boolean;
  disabled?: boolean;
}

export function Switch({ value, disabled }: SwitchProps) {
  const [position] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.spring(position, {
      toValue: value ? 1 : 0,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0,
      SWITCH.TRACK_WIDTH - SWITCH.THUMB - SWITCH.PADDING * 2,
    ],
  });

  return (
    <View
      style={[
        styles.switchTrack,
        {
          backgroundColor: value
            ? THEME.COLORS.BRAND
            : THEME.COLORS.SWITCH_OFF,
        },
        disabled && styles.switchDisabled,
      ]}
    >
      <Animated.View
        style={[styles.switchThumb, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

interface SettingsRowProps {
  label: string;
  /** Optional short supporting line under the label — only for settings
      whose trade-off isn't obvious from the name (Material guidance). */
  description?: string;
  value: boolean;
  onToggle: () => void;
  /** Blocks the toggle while a background transition runs (e.g. the cache
      wipe after turning caching off) — shows the value is in flight. */
  disabled?: boolean;
}

export function SettingsRow({
  label,
  description,
  value,
  onToggle,
  disabled,
}: SettingsRowProps) {
  // A description makes the row tall and top-heavy; without one the label
  // centers cleanly against the switch on the plain 64px row.
  const bodyStyle = description != null ? styles.rowBody : styles.rowBodySingle;
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: disabled || undefined }}
      activeOpacity={0.7}
      onPress={() => {
        haptics.select();
        onToggle();
      }}
      disabled={disabled}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <View style={bodyStyle}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description != null && (
          <Text style={styles.rowDescription}>{description}</Text>
        )}
      </View>
      <Switch value={value} disabled={disabled} />
    </TouchableOpacity>
  );
}

interface ValueRowProps {
  label: string;
  value: string;
  description?: string;
  onPress: () => void;
}

export function ValueRow({ label, value, description, onPress }: ValueRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <View style={description != null ? styles.rowBody : undefined}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description != null && (
          <Text style={styles.rowDescription}>{description}</Text>
        )}
      </View>
      <View style={styles.rowValue}>
        <Text style={styles.rowValueText} numberOfLines={1}>
          {value}
        </Text>
        <MaterialIcons
          name="chevron-right"
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT_DIM}
        />
      </View>
    </TouchableOpacity>
  );
}

interface InfoRowProps {
  label: string;
  description?: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}

/** Non-interactive row that explains a capability (e.g. voice commands). */
export function InfoRow({ label, description, icon }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description != null && (
          <Text style={styles.rowDescription}>{description}</Text>
        )}
      </View>
      <MaterialIcons
        name={icon}
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT_DIM}
      />
    </View>
  );
}
