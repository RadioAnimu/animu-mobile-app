import { useEffect } from "react";
import { InteractionManager, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icon";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { japaneseDictionary } from "@/core/japanese";
import { LyricsService } from "@/core/lyrics";
import { useDict } from "@/hooks/useDict";
import type { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";

/**
 * The lyrics entry on the player: a round glass button in the cover's corner,
 * only while a song (not a jingle) is being heard.
 */
export function LyricsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentTrack } = usePlayer();
  const dict = useDict();

  // At launch, once the player has settled: adopt the Japanese dictionary,
  // or delete an install the app was killed in (no dead files until Settings
  // or the lyrics happen to open).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      japaneseDictionary.restore().catch(() => {});
    });
    return () => task.cancel();
  }, []);

  if (!LyricsService.isSong(currentTrack)) return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={dict.A11Y_OPEN_LYRICS}
      activeOpacity={THEME.OPACITY.PRESSED}
      hitSlop={THEME.HIT_SLOP.MD}
      onPress={() => {
        haptics.tap();
        navigation.navigate("Lyrics");
      }}
      style={styles.button}
    >
      <Icon name="lyrics" size={THEME.ICON.MD} color={THEME.COLORS.TEXT} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: THEME.SPACE.SM,
    bottom: THEME.SPACE.SM,
    width: scale(40),
    height: scale(40),
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: "rgba(22, 1, 53, 0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
});
