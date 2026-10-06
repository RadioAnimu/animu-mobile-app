import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackArrow } from "@/components/BackArrow";
import { HEADER_HEIGHT, styles } from "@/components/ScreenHeader/styles";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";

interface Props {
  title: string;
  onBack: () => void;
}

/**
 * Full-screen page header shared by Account, Settings, Login and Storage:
 * back arrow on the left, title centered between the two 44px slots, and a
 * SURFACE bar that extends under the status bar.
 */
export function ScreenHeader({ title, onBack }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const dict = useDict();

  return (
    <View
      style={[
        styles.header,
        { height: HEADER_HEIGHT + insets.top, paddingTop: insets.top },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={dict.A11Y_BACK}
        activeOpacity={THEME.OPACITY.PRESSED}
        onPress={onBack}
        style={styles.headerButton}
      >
        <BackArrow />
      </TouchableOpacity>
      {/* One line, whatever the language or text size: the bar has a fixed
          height and long titles would otherwise wrap into the content. */}
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.headerTitle}
      >
        {title}
      </Text>
      <View style={styles.headerButton} />
    </View>
  );
}
