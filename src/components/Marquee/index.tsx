import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";

type MarqueeProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Scroll speed in pixels per second — constant no matter how long the text is. */
  speed?: number;
  /** Milliseconds the text holds still at the starting position between loops. */
  delay?: number;
  /** Extra pixels scrolled past the end before the text restarts. */
  spacer?: number;
};

/** Rounding guard: don't animate for sub-pixel overflows. */
const OVERFLOW_TRESHOLD = 1;

/**
 * Lightweight marquee built on the built-in Animated API (native driver).
 *
 * The scrolling layer is a horizontal ScrollView, whose content axis is
 * unbounded — the text can never wrap there, so its content width is the
 * true single-line text width (custom fonts included). Duration is derived
 * from that measured width, so every line moves at the same visual speed
 * and only animates when it actually overflows.
 */
export const Marquee = React.memo(function Marquee({
  text,
  style,
  speed = 60,
  delay = 2500,
  spacer = 20,
}: MarqueeProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const stop = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
    translateX.setValue(0);
  }, [translateX]);

  const overflows =
    containerWidth > 0 &&
    textWidth > 0 &&
    textWidth - containerWidth > OVERFLOW_TRESHOLD;

  useEffect(() => {
    stop();

    // distance > containerWidth guarantees the loop reset jump happens off-screen
    if (!overflows) return;

    const distance = textWidth + spacer;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateX, {
          toValue: -distance,
          duration: (distance / speed) * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    animationRef.current = animation;
    animation.start();

    return stop;
  }, [overflows, textWidth, speed, delay, spacer, stop, translateX]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[style, overflows && styles.ghost]}
      >
        {text}
      </Text>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onContentSizeChange={(width) => setTextWidth(width)}
      >
        <Animated.View
          style={overflows ? { transform: [{ translateX }] } : null}
        >
          <Text numberOfLines={1} style={[style, !overflows && styles.ghost]}>
            {text}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  ghost: {
    opacity: 0,
  },
});
