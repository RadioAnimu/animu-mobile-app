import { Text, TouchableOpacity } from "react-native";
import { THEME } from "@/theme";
import { styles } from "@/components/ButtonKBPS/styles";

interface Props {
  selected: boolean;
  category: string;
  kbps: number;
  handleChangeStream: () => void;
}

export function ButtonKBPS({
  selected,
  category,
  kbps,
  handleChangeStream,
}: Readonly<Props>) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${category} ${kbps} kbps`}
      accessibilityState={{ selected }}
      activeOpacity={THEME.OPACITY.PRESSED}
      onPress={handleChangeStream}
      style={[
        styles.container,
        {
          // The player's selected stream is purple; available options are green.
          backgroundColor: selected ? THEME.COLORS.FRAME : THEME.COLORS.BRAND,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.category,
          {
            color: selected ? THEME.COLORS.TEXT : THEME.COLORS.SURFACE,
          },
        ]}
        numberOfLines={1}
      >
        {category}
      </Text>
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.kbps,
          {
            color: selected ? THEME.COLORS.TEXT : THEME.COLORS.SURFACE,
          },
        ]}
        numberOfLines={1}
      >
        {kbps} kbps
      </Text>
    </TouchableOpacity>
  );
}
