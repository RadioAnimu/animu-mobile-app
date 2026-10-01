import type { ComponentProps, ReactNode } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/ListRow/styles";
import { THEME } from "@/theme";

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/** Fixed leading column that lines every row up with the section headings. */
export function IconBox({ children }: { children: ReactNode }) {
  return <View style={styles.iconBox}>{children}</View>;
}

export function LeadingIcon({ name }: { name: MaterialIconName }) {
  return (
    <IconBox>
      <MaterialIcons
        name={name}
        size={THEME.ICON.MD}
        color={THEME.COLORS.TEXT}
      />
    </IconBox>
  );
}

interface RowBodyProps {
  label: string;
  description?: string;
  /** Replaces the description line with custom content (masked values…). */
  children?: ReactNode;
}

/** The label + optional supporting line every row type renders mid-row. */
export function RowBody({ label, description, children }: RowBodyProps) {
  const hasSecondLine = description != null || children != null;

  return (
    <View style={hasSecondLine ? styles.body : styles.bodySingle}>
      <Text style={styles.label}>{label}</Text>
      {children ??
        (description != null && (
          <Text style={styles.description}>{description}</Text>
        ))}
    </View>
  );
}

export function RowDivider() {
  return <View style={styles.divider} />;
}

interface ActionRowProps {
  label: string;
  icon: MaterialIconName;
  description?: string;
  onPress: () => void;
  /** Blocks the row and shows a spinner while the action runs. */
  busy?: boolean;
}

/** A neutral tappable row for a one-shot action (log out…). */
export function ActionRow({
  label,
  icon,
  description,
  onPress,
  busy,
}: ActionRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: busy || undefined }}
      activeOpacity={0.7}
      disabled={busy}
      onPress={onPress}
      style={[styles.row, busy && styles.rowDisabled]}
    >
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
      {busy && <ActivityIndicator size="small" color={THEME.COLORS.TEXT} />}
    </TouchableOpacity>
  );
}
