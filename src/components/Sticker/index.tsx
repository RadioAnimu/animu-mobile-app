import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { styles } from "@/components/Sticker/styles";
import { THEME } from "@/theme";

interface Props {
  text: string;
  style?: StyleProp<ViewStyle>;
}

/** Tilted katakana callout in the style of Haruka's section art. */
export function Sticker({ text, style }: Props) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.sticker, style]}
    >
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={styles.text}
      >
        {text}
      </Text>
    </View>
  );
}
