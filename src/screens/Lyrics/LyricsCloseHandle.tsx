import { TouchableOpacity, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { closeGesture } from "@/screens/Lyrics/closeGesture";
import { styles } from "@/screens/Lyrics/styles";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";

interface Props {
  onClose: () => void;
}

/**
 * The two-pane head: the grabber alone, over the lyrics pane. Tapping it (or
 * swiping down on it) closes the screen; the artwork and title beside it stay
 * inert so a tap there cannot dismiss by accident.
 */
export function LyricsCloseHandle({ onClose }: Readonly<Props>) {
  const dict = useDict();

  return (
    <GestureDetector gesture={closeGesture(onClose)}>
      <View style={styles.closeHandle}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={dict.A11Y_CLOSE_LYRICS}
          activeOpacity={THEME.OPACITY.PRESSED}
          hitSlop={THEME.HIT_SLOP.MD}
          onPress={onClose}
          style={styles.grabberHit}
        >
          <View style={styles.grabber} />
        </TouchableOpacity>
      </View>
    </GestureDetector>
  );
}
