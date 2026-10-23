import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Icon } from "@/components/Icon";
import { styles } from "@/components/BitrateSelect/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import type { Stream } from "@/core/domain/stream";
import { THEME } from "@/theme";
import { ALL_ORIENTATIONS } from "@/theme/layout";
import { haptics } from "@/utils/haptics";

/** "320 KBPS (MP3)", as the website player names its streams. */
const streamLabel = (stream: Stream): string => `${stream.bitrate} KBPS (${stream.category})`;

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The stream picker of the landscape player bar, as on player.animu.moe: a
 * green pill naming the stream, whose options float under it — the rows of
 * the Settings dropdowns, a check on the one playing. The page under it does
 * not move; a tap outside closes the list.
 */
export function BitrateSelect() {
  const { changeStream, currentStream, streamOptions } = usePlayer();
  const dict = useDict();
  const window = useWindowDimensions();
  const pill = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const streams = streamOptions ?? [];
  const current = streams.find((stream) => stream.url === currentStream?.url);

  const close = () => setAnchor(null);
  const open = () => {
    pill.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  };
  const choose = (stream: Stream) => {
    close();
    if (stream.url === current?.url) return;
    haptics.select();
    changeStream(stream).catch(() => {});
  };

  if (streams.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        ref={pill}
        accessibilityRole="button"
        accessibilityLabel={`${dict.A11Y_STREAM_QUALITY}, ${current ? streamLabel(current) : ""}`}
        accessibilityState={{ expanded: anchor != null }}
        activeOpacity={THEME.OPACITY.PRESSED}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={anchor ? close : open}
        style={styles.pill}
      >
        <Text maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME} numberOfLines={1} style={styles.pillText}>
          {current ? streamLabel(current) : ""}
        </Text>
        <Icon name={anchor ? "expand-less" : "expand-more"} size={THEME.ICON.MD} color={THEME.COLORS.SURFACE} />
      </TouchableOpacity>
      <Modal
        transparent
        visible={anchor != null}
        animationType="fade"
        onRequestClose={close}
        supportedOrientations={ALL_ORIENTATIONS}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={dict.A11Y_CLOSE}
        />
        {anchor ? (
          <View
            accessibilityRole="radiogroup"
            style={[
              styles.list,
              {
                top: anchor.y + anchor.height + THEME.SPACE.XS,
                right: window.width - anchor.x - anchor.width,
                minWidth: anchor.width,
              },
            ]}
          >
            {streams.map((stream, index) => {
              const selected = stream.url === current?.url;
              return (
                <View key={stream.url}>
                  {index > 0 ? <View style={styles.separator} /> : null}
                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityLabel={streamLabel(stream)}
                    accessibilityState={{ checked: selected }}
                    activeOpacity={THEME.OPACITY.PRESSED}
                    onPress={() => choose(stream)}
                    style={styles.option}
                  >
                    <Text
                      maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
                      style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                    >
                      {streamLabel(stream)}
                    </Text>
                    {selected ? <Icon name="check" size={THEME.ICON.MD} color={THEME.COLORS.BRAND} /> : null}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}
      </Modal>
    </>
  );
}
