import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { THEME } from "@/theme";
import { styles } from "@/components/ButtonKBPS/styles";

interface Props {
  selected: boolean;
  busy?: boolean;
  disabled?: boolean;
  category: string;
  kbps: number;
  handleChangeStream: () => void;
}

export function ButtonKBPS({
  selected,
  busy = false,
  disabled = false,
  category,
  kbps,
  handleChangeStream,
}: Readonly<Props>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${category} ${kbps} kbps`}
      accessibilityState={{ selected, busy, disabled }}
      disabled={disabled}
      activeOpacity={THEME.OPACITY.PRESSED}
      onPress={handleChangeStream}
      style={[
        styles.container,
        disabled && { opacity: THEME.OPACITY.DISABLED },
        {
          backgroundColor: selected
            ? THEME.COLORS.BRAND
            : THEME.COLORS.FRAME,
        },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={selected ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT} /> : <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.category,
          {
            color: selected ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT,
          },
        ]}
      >
        {category}
      </Text>}
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.kbps,
          {
            color: selected ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT,
          },
        ]}
      >
        {kbps} kbps
      </Text>
    </TouchableOpacity>
  );
}
