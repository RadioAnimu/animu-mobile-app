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
          // The stream you're on wears the brand fill, like the drawer's
          // current destination — one "selected" look across the app.
          backgroundColor: selected ? THEME.COLORS.BRAND : THEME.COLORS.FRAME,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.category,
          {
            color: selected ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT,
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
            color: selected ? THEME.COLORS.SURFACE : THEME.COLORS.TEXT,
          },
        ]}
        numberOfLines={1}
      >
        {kbps} kbps
      </Text>
    </TouchableOpacity>
  );
}
