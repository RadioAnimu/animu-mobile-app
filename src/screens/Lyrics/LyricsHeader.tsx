import { Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { Cover } from "@/components/Cover";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/screens/Lyrics/styles";
import { THEME } from "@/theme";

/** A downward swipe on the header this long (or this fast) closes the lyrics. */
const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 800;

interface Props {
  cover: string | undefined;
  title: string;
  subtitle: string;
  onClose: () => void;
}

/**
 * Apple Music's sheet head: the grabber (tap or swipe down to close) and the
 * song (cover, title, artist).
 */
export function LyricsHeader({ cover, title, subtitle, onClose }: Readonly<Props>) {
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
        </View>
      </View>
    </GestureDetector>
  );
}
