import type { ComponentProps } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { THEME } from "../../theme";
import { SECTION_ICON_SIZE, styles } from "./styles";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

interface Props {
  title: string;
  icon?: MaterialIconName;
}

/** Uppercase section heading with a leading icon, used across settings pages. */
export function SectionTitle({ title, icon }: Props) {
  return (
    <View style={styles.section}>
      {icon && (
        <View style={styles.iconBox}>
          <MaterialIcons
            name={icon}
            size={SECTION_ICON_SIZE}
            color={THEME.COLORS.TEXT_SOFT}
          />
        </View>
      )}
      <Text style={styles.sectionText}>{title.toUpperCase()}</Text>
    </View>
  );
}
