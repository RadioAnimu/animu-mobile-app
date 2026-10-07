import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

/** Play / pause under the lyrics. */
export function PlaybackBar() {
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const player = usePlayer();

  const toggle = () => {
    haptics.tap();
    const command = player.isPlaying ? player.pause() : player.play();
    command.catch(() => {});
  };

  return (
    <View style={[styles.footerBar, { paddingBottom: insets.bottom + THEME.SPACE.MD }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={player.isPlaying ? dict.A11Y_PAUSE : dict.A11Y_PLAY}
        activeOpacity={THEME.OPACITY.PRESSED}
        onPress={toggle}
        style={styles.playButton}
      >
        <Icon name={player.isPlaying ? "pause" : "play-arrow"} size={THEME.ICON.XL} color={THEME.COLORS.TEXT} />
      </TouchableOpacity>
    </View>
  );
}
