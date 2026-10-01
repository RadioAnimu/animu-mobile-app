import type { ComponentProps } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { styles } from "@/components/PrimaryButton/styles";
import { THEME } from "@/theme";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface Props {
  label: string;
  onPress: () => void;
  /** Replaces the label's icon with a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  icon?: MaterialIconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one filled brand button — the screen's single primary action (sign in,
 * send code). Secondary and destructive actions use rows instead.
 */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const blocked = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: blocked }}
      activeOpacity={0.7}
      disabled={blocked}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={THEME.COLORS.TEXT_ON_LIGHT} />
      ) : (
        icon && (
          <MaterialIcons
            name={icon}
            size={THEME.ICON.MD}
            color={THEME.COLORS.TEXT_ON_LIGHT}
          />
        )
      )}
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
