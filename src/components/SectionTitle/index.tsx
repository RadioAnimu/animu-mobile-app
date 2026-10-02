import type { ComponentProps } from "react";
import { Icon } from "@/components/Icon";
import { Text, View } from "react-native";
import { THEME } from "@/theme";
import { SECTION_ICON_SIZE, styles } from "@/components/SectionTitle/styles";

type MaterialIconName = ComponentProps<typeof Icon>["name"];

interface Props {
  title: string;
  icon?: MaterialIconName;
  /**
   * Drops the heading's top margin for the first section on a screen, so the
   * list opens with the same inset every page uses instead of stacking the
   * margin on top of the content padding.
   */
  first?: boolean;
}

/** Uppercase section heading with a leading icon, used across settings pages. */
export function SectionTitle({ title, icon, first }: Props) {
  return (
    <View
      accessibilityRole="header"
      style={[styles.section, first && styles.sectionFirst]}
    >
      {icon && (
        <View style={styles.iconBox}>
          <Icon
            name={icon}
            size={SECTION_ICON_SIZE}
            color={THEME.COLORS.TEXT}
          />
        </View>
      )}
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
        style={styles.sectionText}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}
