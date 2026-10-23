import { Text, TouchableOpacity, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cover } from "@/components/Cover";
import { useDict } from "@/hooks/useDict";
import { closeGesture } from "@/screens/Lyrics/closeGesture";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface Props {
  cover: string | undefined;
  title: string;
  subtitle: string;
  /** A short window (landscape phone): trim the vertical chrome. */
  short?: boolean;
  onClose: () => void;
}

/**
 * Apple Music's sheet head: the grabber and the song (cover, title, artist).
 * Tapping either, or swiping down on the head, closes the lyrics. The screen's
 * content layer owns the side safe areas, so the notch/island never covers
 * the head in landscape.
 */
export function LyricsHeader({ cover, title, subtitle, short = false, onClose }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const dict = useDict();
  // In an iPadOS window the system's window controls sit over the leading
  // corner, right where the cover thumbnail (a close target) would be.
  const { windowControlsInset } = useResponsiveLayout();

  return (
    <GestureDetector gesture={closeGesture(onClose)}>
      <View style={{ paddingTop: insets.top + THEME.SPACE.XS }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={dict.A11Y_CLOSE_LYRICS}
          activeOpacity={THEME.OPACITY.PRESSED}
          hitSlop={THEME.HIT_SLOP.MD}
          onPress={onClose}
          style={[styles.grabberHit, short && styles.grabberHitCompact]}
        >
          <View style={styles.grabber} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
          accessibilityHint={dict.A11Y_CLOSE_LYRICS}
          activeOpacity={THEME.OPACITY.PRESSED}
          onPress={onClose}
          style={[
            styles.header,
            short && styles.headerCompact,
            windowControlsInset > 0 && { paddingLeft: THEME.SPACE.XXL + windowControlsInset },
          ]}
        >
          {cover ? (
            <Cover cover={cover} style={[styles.thumbnail, short && styles.thumbnailCompact]} category="live" />
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}>
              {title}
            </Text>
            <Text style={styles.artist} numberOfLines={1} maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}>
              {subtitle}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </GestureDetector>
  );
}
