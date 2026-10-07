import { Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import type { Lyrics, LyricsStatus } from "@/core/lyrics";
import { useDict } from "@/hooks/useDict";
import { LyricsMessage } from "@/screens/Lyrics/LyricsMessage";
import { PlainLyrics } from "@/screens/Lyrics/PlainLyrics";
import { SyncedLyrics } from "@/screens/Lyrics/SyncedLyrics";
import { styles } from "@/screens/Lyrics/styles";

interface Props {
  status: LyricsStatus;
  lyrics: Lyrics | null;
  labels: readonly string[];
  position: SharedValue<number>;
  known: boolean;
  reduceMotion: boolean;
  onRetry: () => void;
}

/** The lyrics, or the state standing in for them. */
export function LyricsBody({ status, lyrics, labels, position, known, reduceMotion, onRetry }: Readonly<Props>) {
  const dict = useDict();
  const retry = { label: dict.LYRICS_RETRY, onPress: onRetry };

  if (status === "idle") return <LyricsMessage icon="music-off" title={dict.LYRICS_NOT_A_SONG} />;
  if (status === "loading") return <LyricsMessage loading title={dict.LYRICS_LOADING} />;
  if (status === "error") return <LyricsMessage icon="cloud-off" title={dict.LYRICS_ERROR} action={retry} />;
  if (!lyrics) {
    return <LyricsMessage icon="lyrics" title={dict.LYRICS_MISSING} hint={dict.LYRICS_MISSING_HINT} action={retry} />;
  }
  if (lyrics.kind === "instrumental") {
    return <LyricsMessage icon="music-note" title={dict.LYRICS_INSTRUMENTAL} />;
  }

  const footer = (
    <View style={styles.footer}>
      <Text style={styles.footerText}>{dict.LYRICS_SOURCE}</Text>
    </View>
  );

  if (lyrics.kind === "plain") {
    return (
      <PlainLyrics
        lines={lyrics.lines}
        labels={labels}
        notice={lyrics.otherCut ? dict.LYRICS_UNSYNCED : undefined}
        footer={footer}
      />
    );
  }
  return (
    <SyncedLyrics
      // A new song starts a fresh list (layout, follow state).
      key={lyrics.source.id}
      entries={lyrics.entries}
      labels={labels}
      position={position}
      known={known}
      reduceMotion={reduceMotion}
      footer={footer}
    />
  );
}
