import { useEffect } from "react";
import { InteractionManager, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { KaraokeMicIcon } from "@/components/KaraokeMicIcon";
import { japaneseDictionary } from "@/core/japanese";
import { useDict } from "@/hooks/useDict";
import { useLyricsAvailability } from "@/hooks/useLyricsAvailability";
import type { RootStackParamList } from "@/routes/app.routes";
import { THEME } from "@/theme";
import { haptics } from "@/utils/haptics";

interface Props {
  /** The header's icon size. */
  size: number;
  hitSlop: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The lyrics entry in the player's header: a karaoke microphone in the
 * header's green, greyed out and inactive while the heard song has no lyrics
 * (or is still being looked up). A failed lookup leaves it on: the lyrics
 * retry.
 */
export function LyricsButton({ size, hitSlop, style }: Readonly<Props>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dict = useDict();
  const availability = useLyricsAvailability();
  const enabled = availability === "available" || availability === "unknown";

  // At launch, once the player has settled: adopt the Japanese dictionary,
  // or delete an install the app was killed in (no dead files until Settings
  // or the lyrics happen to open).
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      japaneseDictionary.restore().catch(() => {});
    });
    return () => task.cancel();
  }, []);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={dict.A11Y_OPEN_LYRICS}
      accessibilityHint={availability === "missing" ? dict.LYRICS_MISSING : undefined}
      accessibilityState={{ disabled: !enabled, busy: availability === "checking" }}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={!enabled}
      hitSlop={hitSlop}
      onPress={() => {
        haptics.tap();
        navigation.navigate("Lyrics");
      }}
      style={style}
    >
      <KaraokeMicIcon size={size} color={enabled ? THEME.COLORS.BRAND : THEME.COLORS.TEXT_DIM} />
    </TouchableOpacity>
  );
}
