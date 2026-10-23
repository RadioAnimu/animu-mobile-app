import { Text, View } from "react-native";
import { Cover } from "@/components/Cover";
import { PlayPauseButton } from "@/components/PlayPauseButton";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

/** Side padding inside the panel (the cover keeps this much from its edges). */
const PANEL_PADDING = THEME.SPACE.XXXL;
/** Room under the cover for title, artist and the play button (scaled). */
const CONTROLS_BLOCK = scale(196);
/** A cover smaller than this reads as a thumbnail, not a hero. */
const MIN_COVER = scale(120);
/** The play button under the song: larger than the header's, made for a 10-foot read. */
const PLAY_SIZE = scale(56);

/**
 * How large the hero cover can be: the panel's width minus its padding, or
 * the height left after the title / artist / controls block, whichever is
 * smaller. The block is what keeps the cover from crowding the text on a
 * wide, short window.
 */
function coverSize(width: number, height: number): number {
  const across = width - 2 * PANEL_PADDING;
  const down = height - CONTROLS_BLOCK;
  return Math.max(MIN_COVER, Math.min(across, down));
}

interface Props {
  cover: string | undefined;
  title: string;
  subtitle: string;
  /** Panel width, already inside the window's side safe areas. */
  width: number;
  /** Pane height: the window minus its top and bottom safe areas. */
  height: number;
  /** TV: the D-pad starts on the play button. */
  tv: boolean;
}

/**
 * The two-pane layout's left panel (Apple Music on iPad): the artwork large,
 * with the song and its play button centered under it. Tapping anything here
 * does nothing — dismissing belongs to the grabber over the lyrics.
 */
export function LyricsArtworkPanel({ cover, title, subtitle, width, height, tv }: Readonly<Props>) {
  const size = coverSize(width, height);

  return (
    <View style={[styles.artworkPanel, { width }]}>
      {cover ? (
        <Cover cover={cover} category="live" style={[styles.artworkCover, { width: size, height: size }]} />
      ) : null}
      <View
        style={styles.artworkText}
        accessible
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          style={styles.artworkTitle}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          style={styles.artworkArtist}
        >
          {subtitle}
        </Text>
      </View>
      <PlayPauseButton
        style={[styles.artworkPlay, { width: PLAY_SIZE, height: PLAY_SIZE }]}
        hasTVPreferredFocus={tv}
      />
    </View>
  );
}
