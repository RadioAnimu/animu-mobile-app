import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { styles } from "@/components/ListRow/styles";
import { THEME } from "@/theme";

export type MaterialIconName = ComponentProps<typeof Icon>["name"];

/** Fixed leading column that lines every row up with the section headings. */
export function IconBox({ children }: Readonly<{ children: ReactNode }>) {
  return <View style={styles.iconBox}>{children}</View>;
}

export function LeadingIcon({ name }: Readonly<{ name: MaterialIconName }>) {
  return (
    <IconBox>
      <Icon
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
  /** Extra lines under the label and description (masked values, a value
      stacked under the label at large text sizes…). */
  children?: ReactNode;
}

/** The label + optional supporting line every row type renders mid-row. */
export function RowBody({ label, description, children }: Readonly<RowBodyProps>) {
  const hasSecondLine = description != null || children != null;

  return (
    <View style={hasSecondLine ? styles.body : styles.bodySingle}>
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
        style={styles.label}
      >
        {label}
      </Text>
      {description != null && (
        <Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
          style={styles.description}
        >
          {description}
        </Text>
      )}
      {children}
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
}: Readonly<ActionRowProps>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}, ${description}` : label}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={busy}
      onPress={onPress}
      style={[styles.row, busy && styles.rowDisabled]}
    >
      <LeadingIcon name={icon} />
      <RowBody label={label} description={description} />
      {busy && <ActivityIndicator size="small" color={THEME.COLORS.SPINNER} />}
    </TouchableOpacity>
  );
}
