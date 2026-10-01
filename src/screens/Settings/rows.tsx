import { useEffect, useState } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { Animated, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import {
  LeadingIcon,
  RowBody,
  type MaterialIconName,
} from "@/components/ListRow";
import { THEME } from "@/theme";
import type { Dict } from "@/i18n";
import type { AuthProfile, User } from "@/core/domain/user";
import { styles, SWITCH } from "@/screens/Settings/styles";
import { haptics } from "@/utils/haptics";

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
                {profile?.user.username || user.username}
              </Text>
              {profile?.user.verified && (
                <View style={styles.accountBadge}>
                  <MaterialIcons
                    name="verified"
                    size={THEME.ICON.MD}
                    color={THEME.COLORS.BRAND}
                  />
                </View>
              )}
            </View>
            <Text style={styles.accountCaption} numberOfLines={1}>
              {profile?.user.handle || user.handle
                ? `@${profile?.user.handle || user.handle}`
                : dict.ACCOUNT_TITLE}
            </Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_DIM}
          />
        </>
      ) : (
        <>
          <LeadingIcon name="login" />
          <RowBody label={dict.SETTINGS_ACCOUNT_SIGN_IN} />
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

function Switch({ value, disabled }: SwitchProps) {
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
    outputRange: [0, SWITCH.TRACK_WIDTH - SWITCH.THUMB - SWITCH.PADDING * 2],
  });

  return (
    <View
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? THEME.COLORS.BRAND : THEME.COLORS.SWITCH_OFF,
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
  /** Leading icon that matches the setting to the section's visual language. */
  icon: MaterialIconName;
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
  icon,
  description,
  value,
  onToggle,
  disabled,
}: SettingsRowProps) {
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
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
      <Switch value={value} disabled={disabled} />
    </TouchableOpacity>
  );
}

interface ValueRowProps {
  label: string;
  icon: MaterialIconName;
  value: string;
  description?: string;
  onPress: () => void;
}

export function ValueRow({
  label,
  icon,
  value,
  description,
  onPress,
}: ValueRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
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
  icon: MaterialIconName;
  description?: string;
}

/** Non-interactive row that explains a capability (e.g. voice commands). */
export function InfoRow({ label, icon, description }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
    </View>
  );
}

interface LinkRowProps {
  label: string;
  icon: MaterialIconName;
  description?: string;
  onPress: () => void;
}

/** Opens an external URL — privacy policy, license, store-required links. */
export function LinkRow({ label, icon, description, onPress }: LinkRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
      <MaterialIcons
        name="open-in-new"
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT_DIM}
      />
    </TouchableOpacity>
  );
}
