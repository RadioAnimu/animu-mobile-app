import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { Cover } from "@/components/Cover";
import type { PronunciationMode } from "@/core/lyrics/pronunciation";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";

/** A downward swipe on the header this long (or this fast) closes the lyrics. */
const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 800;

export interface PronunciationButton {
  mode: PronunciationMode;
  /** The dictionary is installed: the button cycles modes, else it offers it. */
  installed: boolean;
  promptOpen: boolean;
  onPress: () => void;
}

interface Props {
  cover: string | undefined;
  title: string;
  subtitle: string;
  /** Shown for Japanese lyrics only. */
  pronunciation: PronunciationButton | null;
  onClose: () => void;
}

/**
 * Apple Music's sheet head: the grabber (tap or swipe down to close), the
 * song (cover, title, artist) and the pronunciation toggle.
 */
export function LyricsHeader({ cover, title, subtitle, pronunciation, onClose }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const dict = useDict();

  const swipeDown = Gesture.Pan()
    .activeOffsetY(12)
    .onEnd((event) => {
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) scheduleOnRN(onClose);
    });

  return (
    <GestureDetector gesture={swipeDown}>
      <View style={{ paddingTop: insets.top + THEME.SPACE.XS }}>
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
        <View style={styles.header}>
          {cover ? <Cover cover={cover} style={styles.thumbnail} category="live" /> : null}
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}>
              {title}
            </Text>
            <Text style={styles.artist} numberOfLines={1} maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}>
              {subtitle}
            </Text>
          </View>
          {pronunciation ? <PronunciationToggle {...pronunciation} /> : null}
        </View>
      </View>
    </GestureDetector>
  );
}

function PronunciationToggle({ mode, installed, promptOpen, onPress }: Readonly<PronunciationButton>) {
  const dict = useDict();
  const on = installed && mode !== "off";
  const modeName = {
    off: dict.LYRICS_PRONUNCIATION_OFF,
    romaji: dict.LYRICS_PRONUNCIATION_ROMAJI,
    hiragana: dict.LYRICS_PRONUNCIATION_HIRAGANA,
  }[mode];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={installed ? `${dict.LYRICS_PRONUNCIATION}, ${modeName}` : dict.LYRICS_PRONUNCIATION}
      accessibilityState={installed ? undefined : { expanded: promptOpen }}
      activeOpacity={THEME.OPACITY.PRESSED}
      hitSlop={THEME.HIT_SLOP.SM}
      onPress={onPress}
      style={[styles.roundButton, on && styles.roundButtonOn]}
    >
      <Text style={[styles.pronunciationGlyph, on && styles.pronunciationGlyphOn]}>
        {on && mode === "hiragana" ? "あ" : "Aa"}
      </Text>
    </TouchableOpacity>
  );
}
