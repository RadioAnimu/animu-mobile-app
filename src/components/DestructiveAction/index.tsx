import type { ComponentProps } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { THEME } from "@/theme";
import { styles } from "@/components/DestructiveAction/styles";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface Props {
  label: string;
  icon: MaterialIconName;
  onPress: () => void;
  /** Blocks the action and shows a spinner while it runs. */
  busy?: boolean;
  /** Optional supporting line under the label. */
  description?: string;
}

/**
 * Destructive action shared by Settings (reset) and Account (log out, delete):
 * one outlined error card, left-aligned, so "this cannot be undone" always
 * looks the same across the app.
 */
export function DestructiveAction({
  label,
  icon,
  onPress,
  busy,
  description,
}: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || undefined }}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={busy}
      style={[styles.action, busy && styles.actionDisabled]}
    >
      <MaterialIcons
        name={busy ? "hourglass-top" : icon}
        size={THEME.ICON.MD}
        color={THEME.COLORS.ERROR}
      />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description != null && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
      {busy && <ActivityIndicator size="small" color={THEME.COLORS.ERROR} />}
    </TouchableOpacity>
  );
}
