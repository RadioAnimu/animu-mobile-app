import { Text, View } from "react-native";

import { Sticker } from "@/components/Sticker";
import { styles } from "@/components/SheetBanner/styles";
import { THEME } from "@/theme";

interface Props {
  title: string;
  /** Red on-air dot before the title. */
  live?: boolean;
  /** Katakana callout pinned to the banner's corner. */
  sticker?: string;
}

/** The chunky green title strip, like the banners on Haruka's section art. */
export function SheetBanner({ title, live = false, sticker }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.banner}>
        {live && <View style={styles.liveDot} />}
        <Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          accessibilityRole="header"
          style={styles.title}
        >
          {title}
        </Text>
      </View>
      {sticker && <Sticker text={sticker} style={styles.sticker} />}
    </View>
  );
}
