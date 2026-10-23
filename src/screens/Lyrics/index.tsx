import { useCallback } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
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
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { japaneseDictionary } from "@/core/japanese";
import type { RootStackParamList } from "@/routes/app.routes";
import { LyricsArtworkPanel } from "@/screens/Lyrics/LyricsArtworkPanel";
import { LyricsBackground, useBackgroundTurn } from "@/screens/Lyrics/LyricsBackground";
import { LyricsBody } from "@/screens/Lyrics/LyricsBody";
import { LyricsCloseHandle } from "@/screens/Lyrics/LyricsCloseHandle";
import { LyricsHeader } from "@/screens/Lyrics/LyricsHeader";
import { PronunciationMenu } from "@/screens/Lyrics/PronunciationMenu";
import { paneLayout, TWO_PANE_MIN_WIDTH } from "@/screens/Lyrics/geometry";
import { CLOSE_HANDLE_HEIGHT, LYRICS_COLUMN_MAX, styles } from "@/screens/Lyrics/styles";
import { usePronunciation } from "@/screens/Lyrics/usePronunciation";
import { THEME } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Lyrics">;

/** How far the lyrics blur back while the pronunciation menu is out. */
const MENU_BLUR = 6;

/**
 * Full-screen lyrics of the song being heard, Apple Music style: the cover's
 * colors drifting behind, the active line lit and followed, words filling as
 * they are sung (when the lyrics carry word timing), breathing dots through
 * instrumental breaks, and romaji / hiragana under Japanese lines.
 *
 * Arrangement follows the live window: a phone keeps the sheet's single
 * column (pixel-identical in portrait), a wide window puts the artwork and
 * controls beside the lyrics. The body sits at the same place in the tree in
 * both arrangements, so rotating does not remount the list or lose the
 * follow state.
 */
export function Lyrics({ navigation }: Readonly<Props>) {
  const dict = useDict();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
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

  const onClose = useCallback(() => navigation.goBack(), [navigation]);
  const title = track?.title ?? "";
  const subtitle = syncing ? `${dict.SYNCHRONIZING}…` : (track?.artist ?? "");

  // Every landscape window puts the artwork beside the lyrics.
  const twoPane = layout.split && layout.usableWidth >= TWO_PANE_MIN_WIDTH;
  const { artworkWidth, lyricsWidth, sideMargin } = paneLayout(layout.usableWidth, twoPane, LYRICS_COLUMN_MAX);
  // The menu sits in the lyrics pane's bottom-right corner, never wider than
  // that pane minus its margins.
  const menuRight = insets.right + sideMargin + THEME.SPACE.XXL;
  const menuMaxWidth = lyricsWidth - 2 * THEME.SPACE.XXL;

  return (
    <GestureHandlerRootView style={styles.container}>
      <LyricsBackground cover={cover} turn={turn} />
      <View
        style={[
          styles.content,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            paddingTop: twoPane ? insets.top : 0,
          },
        ]}
      >
        {/* Two panes: the grabber heads the whole window, centered. */}
        {twoPane ? <LyricsCloseHandle onClose={onClose} /> : null}
        <View style={styles.panes}>
          {twoPane ? (
            <LyricsArtworkPanel
              key="artwork"
              cover={cover}
              title={title}
              subtitle={subtitle}
              width={artworkWidth}
              height={layout.height - insets.top - insets.bottom - CLOSE_HANDLE_HEIGHT}
              onClose={onClose}
            />
          ) : null}
          <View key="main" style={[styles.main, twoPane && { maxWidth: lyricsWidth }]}>
            {twoPane ? null : (
              <LyricsHeader cover={cover} title={title} subtitle={subtitle} short={layout.short} onClose={onClose} />
            )}
            <PronunciationNotice
              preparing={pronunciation.preparing}
              failed={pronunciation.failed}
              style={twoPane ? styles.columnCap : undefined}
            />
            <Animated.View style={[styles.body, styles.columnCap, recede]}>
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
          </View>
        </View>
      </View>
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
          right={menuRight}
          maxWidth={menuMaxWidth}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

/** Why the labels are not there yet (being prepared) or at all (failed). */
function PronunciationNotice({
  preparing,
  failed,
  style,
}: Readonly<{ preparing: boolean; failed: boolean; style?: StyleProp<ViewStyle> }>) {
  const dict = useDict();
  if (!preparing && !failed) return null;
  return (
    <View style={style}>
      <Text style={[styles.notice, styles.column]} accessibilityLiveRegion="polite">
        {failed ? dict.LYRICS_DICTIONARY_FAILED : dict.LYRICS_DICTIONARY_PREPARING}
      </Text>
    </View>
  );
}
