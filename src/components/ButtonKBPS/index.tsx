import { Animated, Text, TouchableOpacity } from "react-native";
import { THEME } from "@/theme";
import { styles } from "@/components/ButtonKBPS/styles";
import { useBlink } from "@/hooks/useBlink";

interface Props {
  selected: boolean;
  category: string;
  kbps: number;
  /** Picked, not heard yet: the pill pulses until the switch lands. */
  switching?: boolean;
  /** Read after the format and bitrate (e.g. "AUTO", "switching"). */
  labelSuffix?: string;
  handleChangeStream: () => void;
}

export function ButtonKBPS({
  selected,
  category,
  kbps,
  switching = false,
  labelSuffix,
  handleChangeStream,
}: Readonly<Props>) {
  const blink = useBlink(switching);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[`${category} ${kbps} kbps`, labelSuffix].filter(Boolean).join(", ")}
      accessibilityState={{ selected, busy: switching }}
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
      <Animated.View style={[styles.label, { opacity: blink }]}>
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
      </Animated.View>
    </TouchableOpacity>
  );
}
