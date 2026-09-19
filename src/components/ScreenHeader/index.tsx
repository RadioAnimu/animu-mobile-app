import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackArrow } from "@/components/BackArrow";
import { HEADER_HEIGHT, styles } from "@/components/ScreenHeader/styles";
import { useDict } from "@/hooks/useDict";

interface Props {
  title: string;
  onBack: () => void;
}

/**
 * Full-screen page header shared by Account, Settings, Login and Storage:
 * back arrow on the left, title centered between the two 44px slots, and a
 * SURFACE bar that extends under the status bar.
 */
export function ScreenHeader({ title, onBack }: Props) {
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
        onPress={onBack}
        style={styles.headerButton}
      >
        <BackArrow />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerButton} />
    </View>
  );
}
