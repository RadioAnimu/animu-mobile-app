import { Text } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { useHeardPosition } from "@/hooks/useHeardPosition";
import { useLyrics } from "@/hooks/useLyrics";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";
import { japaneseDictionary } from "@/core/japanese";
import type { RootStackParamList } from "@/routes/app.routes";
import { LyricsBackground, useBackgroundTurn } from "@/screens/Lyrics/LyricsBackground";
import { LyricsBody } from "@/screens/Lyrics/LyricsBody";
import { LyricsHeader } from "@/screens/Lyrics/LyricsHeader";
import { PronunciationMenu } from "@/screens/Lyrics/PronunciationMenu";
import { styles } from "@/screens/Lyrics/styles";
import { usePronunciation } from "@/screens/Lyrics/usePronunciation";

type Props = NativeStackScreenProps<RootStackParamList, "Lyrics">;

/** How far the lyrics blur back while the pronunciation menu is out. */
const MENU_BLUR = 6;

/**
 * Full-screen lyrics of the song being heard, Apple Music style: the cover's
 * colors drifting behind, the active line lit and followed, words filling as
 * they are sung (when the lyrics carry word timing), breathing dots through
 * instrumental breaks, and romaji / hiragana under Japanese lines.
 */
export function Lyrics({ navigation }: Readonly<Props>) {
  const dict = useDict();
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const reduceMotion = useReducedMotion();
  const isBackgrounded = useIsBackgrounded();
  const isFocused = useIsFocused();
  const { status, lyrics, retry } = useLyrics();
  const pronunciation = usePronunciation(lyrics);

  const track = player.currentTrack;
  const cover = useResolvedArtwork(track?.artwork || undefined, track?.artworks) ?? player.defaultArtwork;
  const visible = isFocused && !isBackgrounded;
  const synced = lyrics?.kind === "synced";
  const clock = useHeardPosition(track?.raw, visible && synced);
  const syncing = synced && !clock.known && player.isPlaying;
  const turn = useBackgroundTurn(visible && !reduceMotion);
  const menu = useSharedValue(0);
  // Always a blur (0 at rest): an emptied filter list leaves the last blur on iOS.
  const recede = useAnimatedStyle(() => ({
    filter: [{ blur: interpolate(menu.get(), [0, 1], [0, MENU_BLUR], "clamp") }],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <LyricsBackground cover={cover} turn={turn} />
      <LyricsHeader
        cover={cover}
        title={track?.title ?? ""}
        subtitle={syncing ? `${dict.SYNCHRONIZING}…` : (track?.artist ?? "")}
        onClose={() => navigation.goBack()}
      />
      <PronunciationNotice preparing={pronunciation.preparing} failed={pronunciation.failed} />
      <Animated.View style={[styles.body, { marginBottom: insets.bottom }, recede]}>
        <LyricsBody
          status={status}
          lyrics={lyrics}
          labels={pronunciation.labels}
          position={clock.position}
          known={clock.known}
          reduceMotion={reduceMotion}
          onRetry={retry}
        />
      </Animated.View>
      {pronunciation.modes.length > 0 ? (
        <PronunciationMenu
          mode={pronunciation.mode}
          modes={pronunciation.modes}
          dictionary={pronunciation.dictionary}
          onSelect={pronunciation.select}
          onInstall={() => {
            japaneseDictionary.install().catch(() => {});
          }}
          onCancelInstall={() => {
            japaneseDictionary.cancel().catch(() => {});
          }}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
          cover={cover}
          turn={turn}
          progress={menu}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

/** Why the labels are not there yet (being prepared) or at all (failed). */
function PronunciationNotice({ preparing, failed }: Readonly<{ preparing: boolean; failed: boolean }>) {
  const dict = useDict();
  if (!preparing && !failed) return null;
  return (
    <Text style={[styles.notice, styles.column]} accessibilityLiveRegion="polite">
      {failed ? dict.LYRICS_DICTIONARY_FAILED : dict.LYRICS_DICTIONARY_PREPARING}
    </Text>
  );
}
