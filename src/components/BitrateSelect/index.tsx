import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, type ViewInstance } from "react-native";
import { Icon } from "@/components/Icon";
import { styles } from "@/components/BitrateSelect/styles";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useDict } from "@/hooks/useDict";
import { AUTO_QUALITY, type Stream } from "@/core/domain/stream";
import type { QualityChoice } from "@/core/player";
import { useBlink } from "@/hooks/useBlink";
import { shownQuality } from "@/utils/stream-quality";
import { THEME } from "@/theme";
import { ALL_ORIENTATIONS } from "@/theme/layout";
import { haptics } from "@/utils/haptics";

/** "320 KBPS (MP3)", as the website player names its streams. */
const streamLabel = (stream: Stream): string => `${stream.bitrate} KBPS (${stream.category})`;

/** One row of the list: a stream, or automatic quality. */
interface Choice {
  key: string;
  label: string;
  value: QualityChoice;
  checked: boolean;
}

/** Room the list keeps from the window's edges. */
const EDGE = THEME.SPACE.SM;

/**
 * Where the list floats: under the pill, its right edge on the pill's, held
 * inside the window — scrolling when the window is too short for it.
 */
function listFrame(anchor: Anchor, window: { width: number; height: number }) {
  const top = anchor.y + anchor.height + THEME.SPACE.XS;
  return {
    top,
    right: Math.max(EDGE, window.width - anchor.x - anchor.width),
    minWidth: anchor.width,
    maxHeight: Math.max(0, window.height - top - EDGE),
  };
}

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
 *
 * Automatic quality heads the list; the pill then names what RNAP plays
 * ("AUTO · 192 KBPS"). A picked stream not heard yet pulses the pill.
 */
export function BitrateSelect() {
  const player = usePlayer();
  const { changeStream, autoQuality, streamOptions } = player;
  const dict = useDict();
  const window = useWindowDimensions();
  const pill = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const streams = streamOptions ?? [];
  const shown = shownQuality(player);
  const blink = useBlink(shown.switching);
  // The stream shown names the pill even if the list no longer holds it.
  const current = streams.find((stream) => stream.id === shown.stream?.id) ?? shown.stream;
  let currentLabel = current ? streamLabel(current) : "";
  if (current && autoQuality) currentLabel = `${dict.QUALITY_AUTO} · ${current.bitrate} KBPS`;
  const choices: Choice[] = [
    { key: AUTO_QUALITY, label: dict.QUALITY_AUTO_OPTION, value: AUTO_QUALITY, checked: Boolean(autoQuality) },
    ...streams.map((stream) => ({
      key: stream.url,
      label: streamLabel(stream),
      value: stream,
      checked: !autoQuality && stream.id === current?.id,
    })),
  ];

  // The list hangs from where the pill was when it opened: a rotation or a
  // resized window moves the pill, so the list closes rather than float
  // detached.
  useEffect(() => {
    setAnchor(null);
  }, [window.width, window.height]);

  const close = () => setAnchor(null);
  const open = () => {
    pill.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  };
  const choose = (choice: Choice) => {
    close();
    if (choice.checked) return;
    haptics.select();
    changeStream(choice.value).catch(() => {});
  };

  if (streams.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        ref={pill}
        accessibilityRole="button"
        accessibilityLabel={[dict.A11Y_STREAM_QUALITY, currentLabel, shown.switching && dict.A11Y_QUALITY_SWITCHING]
          .filter(Boolean)
          .join(", ")}
        accessibilityState={{ expanded: anchor != null, busy: shown.switching }}
        activeOpacity={THEME.OPACITY.PRESSED}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={anchor ? close : open}
        style={styles.pill}
      >
        <Animated.Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          numberOfLines={1}
          style={[styles.pillText, { opacity: blink }]}
        >
          {currentLabel}
        </Animated.Text>
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
            style={[styles.list, listFrame(anchor, window)]}
          >
            <ScrollView bounces={false}>
              {/* react-doctor-disable-next-line rn-no-scrollview-mapped-list -- the station's few bitrates, not a list to virtualize. */}
              {choices.map((choice, index) => {
                const selected = choice.checked;
                return (
                  <View key={choice.key}>
                    {index > 0 ? <View style={styles.separator} /> : null}
                    <TouchableOpacity
                      accessibilityRole="radio"
                      accessibilityLabel={choice.label}
                      accessibilityState={{ checked: selected }}
                      activeOpacity={THEME.OPACITY.PRESSED}
                      onPress={() => choose(choice)}
                      style={styles.option}
                    >
                      <Text
                        maxFontSizeMultiplier={THEME.FONT_SCALE.CONTENT}
                        style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                      >
                        {choice.label}
                      </Text>
                      {selected ? <Icon name="check" size={THEME.ICON.MD} color={THEME.COLORS.BRAND} /> : null}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}
