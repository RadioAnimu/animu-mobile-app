import type { ComponentProps } from "react";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";

type Props = ComponentProps<typeof MaterialIcons>;

export type IconName = Props["name"];

/**
 * The app's one icon family (Material Icons), always decorative: the glyph
 * (a private-use character in a Text node) is kept out of the accessibility
 * tree. Controls that pair an icon with text carry an explicit
 * `accessibilityLabel`, since composed labels would otherwise read the glyph
 * as an empty item (", Language, Português, ").
 */
export function Icon(props: Props) {
  return (
    <MaterialIcons
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...props}
    />
  );
}
