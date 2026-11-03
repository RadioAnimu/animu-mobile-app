import { Text, TouchableOpacity, View } from "react-native";
import { Cover } from "@/components/Cover";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

/** Side padding inside the panel (the cover keeps this much from its edges). */
const PANEL_PADDING = THEME.SPACE.XXXL;
/** Room under the cover for the title and artist (scaled). */
const CONTROLS_BLOCK = scale(120);
/** A cover smaller than this reads as a thumbnail, not a hero. */
const MIN_COVER = scale(120);

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
  /** Pane height: the window minus its safe areas and the grabber's row. */
  height: number;
  onClose: () => void;
}

/**
 * The two-pane layout's left panel (Apple Music on iPad): the artwork large,
 * with the song centered under it — no playback controls, as in the portrait
 * lyrics. Like the song row of the portrait head, a tap on it closes the
 * lyrics.
 */
export function LyricsArtworkPanel({ cover, title, subtitle, width, height, onClose }: Readonly<Props>) {
  const dict = useDict();
  const size = coverSize(width, height);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={dict.A11Y_CLOSE_LYRICS}
      activeOpacity={THEME.OPACITY.PRESSED}
      onPress={onClose}
      style={[styles.artworkPanel, { width }]}
    >
      {cover ? (
        <Cover cover={cover} category="live" style={[styles.artworkCover, { width: size, height: size }]} />
      ) : null}
      <View style={styles.artworkText}>
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
    </TouchableOpacity>
  );
}
