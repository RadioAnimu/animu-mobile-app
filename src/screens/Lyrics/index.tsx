import { Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { useHeardPosition } from "@/hooks/useHeardPosition";
import { useLyrics } from "@/hooks/useLyrics";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useResolvedArtwork } from "@/hooks/useResolvedArtwork";
import type { RootStackParamList } from "@/routes/app.routes";
import { DictionaryPrompt } from "@/screens/Lyrics/DictionaryPrompt";
import { LyricsBackground } from "@/screens/Lyrics/LyricsBackground";
import { LyricsBody } from "@/screens/Lyrics/LyricsBody";
import { LyricsHeader } from "@/screens/Lyrics/LyricsHeader";
import { PlaybackBar } from "@/screens/Lyrics/PlaybackBar";
import { styles } from "@/screens/Lyrics/styles";
import { usePronunciation } from "@/screens/Lyrics/usePronunciation";

type Props = NativeStackScreenProps<RootStackParamList, "Lyrics">;

/**
 * Full-screen lyrics of the song being heard, Apple Music style: the cover's
 * colors drifting behind, the active line lit and followed, words filling as
 * they are sung (when the lyrics carry word timing), breathing dots through
 * instrumental breaks, and romaji / hiragana under Japanese lines.
 */
export function Lyrics({ navigation }: Readonly<Props>) {
  const dict = useDict();
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

  return (
    <GestureHandlerRootView style={styles.container}>
      <LyricsBackground cover={cover} animate={visible && !reduceMotion} />
      <LyricsHeader
        cover={cover}
        title={track?.title ?? ""}
        subtitle={syncing ? `${dict.SYNCHRONIZING}…` : (track?.artist ?? "")}
        pronunciation={pronunciation.button}
        onClose={() => navigation.goBack()}
      />
      {pronunciation.promptOpen ? <DictionaryPrompt dictionary={pronunciation.dictionary} /> : null}
      {pronunciation.preparing ? (
        <Text style={[styles.notice, styles.column]}>{dict.LYRICS_DICTIONARY_PREPARING}</Text>
      ) : null}
      <View style={styles.body}>
        <LyricsBody
          status={status}
          lyrics={lyrics}
          labels={pronunciation.labels}
          position={clock.position}
          known={clock.known}
          reduceMotion={reduceMotion}
          onRetry={retry}
        />
      </View>
      <PlaybackBar />
    </GestureHandlerRootView>
  );
}
