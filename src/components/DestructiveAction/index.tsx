import type { ComponentProps } from "react";
import { Icon } from "@/components/Icon";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { THEME } from "@/theme";
import { styles } from "@/components/DestructiveAction/styles";

type MaterialIconName = ComponentProps<typeof Icon>["name"];

interface Props {
  label: string;
  icon: MaterialIconName;
  onPress: () => void;
  /** Blocks the action and shows a spinner while it runs. */
  busy?: boolean;
  /** Optional supporting line under the label. */
  description?: string;
  /** Blocks and dims the action without a spinner (another one is running). */
  disabled?: boolean;
}

/**
 * Destructive action shared by Settings (reset) and Account (delete):
 * one solid danger fill, left-aligned, so "this cannot be undone" always looks
 * the same across the app.
 */
export function DestructiveAction({
  label,
  icon,
  onPress,
  busy,
  description,
  disabled,
}: Readonly<Props>) {
  const blocked = !!busy || !!disabled;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ busy: !!busy, disabled: blocked }}
      activeOpacity={THEME.OPACITY.PRESSED}
      onPress={onPress}
      disabled={blocked}
      style={[styles.action, blocked && styles.actionDisabled]}
    >
      <View style={styles.iconBox}>
        <Icon
          name={busy ? "hourglass-top" : icon}
          size={THEME.ICON.MD}
          color={THEME.COLORS.TEXT}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description != null && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
      {busy && <ActivityIndicator size="small" color={THEME.COLORS.TEXT} />}
    </TouchableOpacity>
  );
}
