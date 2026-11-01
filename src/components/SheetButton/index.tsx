import type { ComponentProps } from "react";
import { Icon } from "@/components/Icon";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

import { styles } from "@/components/SheetButton/styles";
import { THEME } from "@/theme";

type MaterialIconName = ComponentProps<typeof Icon>["name"];

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  /** Shown after the label. */
  icon?: MaterialIconName;
}

/** The solid green action button at the foot of the request sheets. */
export function SheetButton({
  label,
  onPress,
  loading = false,
  icon,
}: Readonly<Props>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={loading}
      onPress={onPress}
      style={[styles.button, loading && styles.busy]}
    >
      {loading ? (
        <ActivityIndicator color={THEME.COLORS.SURFACE} />
      ) : (
        <>
          <Text
            maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
            style={styles.label}
          >
            {label}
          </Text>
          {icon && (
            <Icon
              name={icon}
              size={THEME.ICON.MD}
              color={THEME.COLORS.SURFACE}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}
