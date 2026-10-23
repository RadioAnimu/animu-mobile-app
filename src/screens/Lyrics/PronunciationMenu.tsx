import { type ReactNode, useState } from "react";
import { Pressable, type StyleProp, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Icon } from "@/components/Icon";
import type { JapaneseDictionarySnapshot } from "@/core/japanese";
import type { PronunciationMode } from "@/core/lyrics/pronunciation";
import { useDict } from "@/hooks/useDict";
import type { Dict } from "@/i18n";
import { LyricsBackground } from "@/screens/Lyrics/LyricsBackground";
import { type PronunciationGlyph, PronunciationIcon } from "@/screens/Lyrics/PronunciationIcon";
import { dictionarySize } from "@/screens/Settings/sections/dictionary-size";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";

/**
 * Opening: the menu slides out of the button on Apple's menu spring —
 * quick, a breath of overshoot, no wobble.
 */
const OPEN_SPRING = { duration: 420, dampingRatio: 0.8 };
/** Closing: critically damped and quicker — the menu tucks back into its button. */
const CLOSE_SPRING = { duration: 300, dampingRatio: 1 };
/** The glass button swelling under the finger, and settling back. */
const PRESS_SPRING = { duration: 260, dampingRatio: 0.6 };
/** How far the glass swells under the finger. */
const PRESS_SWELL = 0.12;
/** The button's glyph turns this far (deg, counter-clockwise) while its menu is out. */
const OPEN_TURN = -33;
/** Blur the glass adds over the backdrop it covers. */
const FROST = 40;

interface Props {
  mode: PronunciationMode;
  /** Modes the song can show now (romaji from a sibling upload needs no dictionary). */
  modes: readonly PronunciationMode[];
  dictionary: JapaneseDictionarySnapshot;
  onSelect: (mode: PronunciationMode) => void;
  onInstall: () => void;
  onCancelInstall: () => void;
  bottomInset: number;
  reduceMotion: boolean;
  /** The backdrop the glass frosts: its cover and drift clock. */
  cover: string | undefined;
  turn: SharedValue<number>;
  /** 0 closed → 1 open, driven here, read by the screen to blur what's behind. */
  progress: SharedValue<number>;
  /**
   * Screen x of the pane the menu hangs from (the lyrics pane in two-pane
   * mode). Defaults to the phone's left margin.
   */
  left?: number;
  /** Widest the menu may be on a narrow window / pane (default: 290pt). */
  maxWidth?: number;
}

/**
 * Apple Music's lyrics menu: a round glass button bottom-left whose menu of
 * pronunciations — romaji, hiragana, off — slides out of it, with the
 * Japanese dictionary offered (and its download shown) where a mode needs
 * it. Both are clear glass over a heavy blur, stained with the cover's own color; the
 * button's glyph turns while the menu is out. Reduce Motion cross-fades.
 */
export function PronunciationMenu({
  mode,
  modes,
  dictionary,
  onSelect,
  onInstall,
  onCancelInstall,
  bottomInset,
  reduceMotion,
  cover,
  turn,
  progress,
  left,
  maxWidth,
}: Readonly<Props>) {
  const dict = useDict();
  const [open, setOpen] = useState(false);
  // Outlives `open` by the closing slide, so the menu tucks away before unmounting.
  const [shown, setShown] = useState(false);
  const press = useSharedValue(0);
  const bottom = bottomInset + THEME.SPACE.LG;
  const menuBottom = bottom + BUTTON + THEME.SPACE.SM;
  const anchorLeft = left ?? MENU_LEFT;
  // A narrow window (or the lyrics pane) may be smaller than the menu: never
  // let it run off the edge.
  const menuWidth = maxWidth === undefined ? MENU_WIDTH : Math.min(MENU_WIDTH, Math.max(0, maxWidth));

  const toggle = (next: boolean) => {
    setOpen(next);
    if (next) setShown(true);
    const target = Number(next);
    const done = (finished = false) => {
      "worklet";
      if (finished && !next) scheduleOnRN(setShown, false);
    };
    const spring = next ? OPEN_SPRING : CLOSE_SPRING;
    progress.set(
      reduceMotion
        ? withTiming(target, { duration: MOTION.DURATION.NORMAL }, done)
        : withSpring(target, spring, done),
    );
  };

  const choose = (next: PronunciationMode) => {
    haptics.select();
    onSelect(next);
    toggle(false);
  };

  const sliding = !reduceMotion;
  const button = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + PRESS_SWELL * press.get() }],
  }));
  const glint = useAnimatedStyle(() => ({ opacity: press.get() }));
  const glyph = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(sliding ? progress.get() : Math.round(progress.get())) * OPEN_TURN}deg` }],
  }));
  // Slides up out of the button's middle, growing from its corner there.
  const menu = useAnimatedStyle(() => {
    const p = progress.get();
    if (!sliding) return { opacity: p };
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: (1 - p) * (BUTTON / 2) },
        { translateY: (1 - p) * (BUTTON / 2 + THEME.SPACE.SM) },
        { scale: interpolate(p, [0, 1], [0.15, 1]) },
      ],
    };
  });
  const items = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: sliding ? interpolate(p, [0.4, 0.9], [0, 1], Extrapolation.CLAMP) : 1,
      transform: [{ translateY: sliding ? interpolate(p, [0, 1], [THEME.SPACE.SM, 0]) : 0 }],
    };
  });
  const dim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const choices: { mode: PronunciationMode; label: string; glyph: PronunciationGlyph }[] = [
    { mode: "romaji", label: dict.LYRICS_PRONUNCIATION_ROMAJI, glyph: "romaji" },
    { mode: "hiragana", label: dict.LYRICS_PRONUNCIATION_HIRAGANA, glyph: "hiragana" },
    { mode: "off", label: dict.LYRICS_PRONUNCIATION_OFF, glyph: "off" },
  ];

  return (
    <>
      {shown ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => toggle(false)}
          accessibilityLabel={dict.A11Y_CLOSE}
          accessibilityRole="button"
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dim]} />
        </Pressable>
      ) : null}
      {shown ? (
        <Animated.View
          style={[styles.menu, { bottom: menuBottom, left: anchorLeft, width: menuWidth }, menu]}
          pointerEvents={open ? "auto" : "none"}
          accessibilityRole="menu"
        >
          <Glass cover={cover} turn={turn} left={anchorLeft} bottom={menuBottom} style={styles.menuGlass}>
            <Animated.View style={items}>
              {choices.map((item, index) => {
                const available = modes.includes(item.mode);
                const selected = available && item.mode === mode;
                return (
                  <View key={item.mode}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      accessibilityRole="menuitem"
                      accessibilityState={{ checked: selected, disabled: !available }}
                      accessibilityHint={available ? undefined : dict.LYRICS_DICTIONARY_NEEDED}
                      disabled={!available}
                      onPress={() => choose(item.mode)}
                      style={({ pressed }) => [styles.item, pressed && styles.itemPressed, !available && styles.itemDisabled]}
                    >
                      <PronunciationIcon glyph={item.glyph} size={THEME.ICON.LG} />
                      <View style={styles.itemText}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        {available ? null : <Text style={styles.itemHint}>{dict.LYRICS_DICTIONARY_NEEDED}</Text>}
                      </View>
                      {selected ? <Icon name="check" size={THEME.ICON.MD} color={THEME.COLORS.TEXT} /> : null}
                    </Pressable>
                  </View>
                );
              })}
              {dictionary.install === "installed" ? null : (
                <DictionaryItem dictionary={dictionary} onInstall={onInstall} onCancel={onCancelInstall} />
              )}
            </Animated.View>
          </Glass>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.button, { bottom, left: anchorLeft }, button]}>
        <Glass cover={cover} turn={turn} left={anchorLeft} bottom={bottom} style={styles.buttonGlass}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.glint, glint]} pointerEvents="none" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dict.LYRICS_PRONUNCIATION}
            accessibilityState={{ expanded: open }}
            hitSlop={THEME.HIT_SLOP.SM}
            // Reanimated 4 runs the spring on the UI thread; only its start comes
            // from JS, as with any Pressable. A GestureDetector tap instead trips
            // rn-prefer-pressable-over-gesture-detector and drops Pressable's
            // accessibility semantics.
            // react-doctor-disable-next-line rn-pressable-shared-value-mutation -- spring runs on UI; see above
            onPressIn={() => press.set(withSpring(1, PRESS_SPRING))}
            // react-doctor-disable-next-line rn-pressable-shared-value-mutation -- spring runs on UI; see above
            onPressOut={() => press.set(withSpring(0, PRESS_SPRING))}
            onPress={() => {
              haptics.tap();
              toggle(!open);
            }}
            style={styles.buttonHit}
          >
            <Animated.View style={glyph}>
              <PronunciationIcon glyph="menu" size={scale(28)} />
            </Animated.View>
          </Pressable>
        </Glass>
      </Animated.View>
    </>
  );
}

interface GlassProps {
  cover: string | undefined;
  turn: SharedValue<number>;
  /** Where the glass sits on screen, to line its backdrop up with the real one. */
  left: number;
  bottom: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * The glass, drawn the stats card's share button's way: the backdrop right
 * behind it — redrawn in step, blurred further — under a faint sheen and a
 * light rim. Its color is the cover's own, wherever it sits.
 */
function Glass({ cover, turn, left, bottom, style, children }: Readonly<GlassProps>) {
  const window = useWindowDimensions();
  return (
    <View style={[styles.glass, style]}>
      <LyricsBackground
        cover={cover}
        turn={turn}
        extraBlur={FROST}
        fade={false}
        style={{ position: "absolute", width: window.width, height: window.height, left: -left, bottom: -bottom }}
      />
      <View style={[StyleSheet.absoluteFill, styles.sheen]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Its sizes, its progress, or why it failed. */
function hintOf(dictionary: JapaneseDictionarySnapshot, dict: Dict): string {
  if (dictionary.install === "downloading") return `${Math.round(dictionary.progress * 100)}%`;
  if (dictionary.failure === "space") return dict.SETTINGS_JP_DICTIONARY_NO_SPACE;
  if (dictionary.failure === "network") return dict.SETTINGS_JP_DICTIONARY_ERROR;
  return dictionarySize(dict);
}

/** Download the dictionary, or follow (and stop) its download. */
function DictionaryItem({
  dictionary,
  onInstall,
  onCancel,
}: Readonly<{ dictionary: JapaneseDictionarySnapshot; onInstall: () => void; onCancel: () => void }>) {
  const dict = useDict();
  const downloading = dictionary.install === "downloading";
  const hint = hintOf(dictionary, dict);

  return (
    <View>
      <View style={styles.sectionDivider} />
      <Pressable
        accessibilityRole="menuitem"
        accessibilityLabel={`${downloading ? dict.SETTINGS_JP_DICTIONARY_STOP : dict.SETTINGS_JP_DICTIONARY_ROW}, ${hint}`}
        onPress={() => {
          haptics.tap();
          if (downloading) onCancel();
          else onInstall();
        }}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <Icon name={downloading ? "close" : "download"} size={THEME.ICON.LG} color={THEME.COLORS.TEXT} />
        <View style={styles.itemText}>
          <Text style={styles.itemLabel}>
            {downloading ? dict.SETTINGS_JP_DICTIONARY_STOP : dict.SETTINGS_JP_DICTIONARY_ROW}
          </Text>
          <Text style={styles.itemHint}>{hint}</Text>
        </View>
      </Pressable>
      {downloading ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, Math.round(dictionary.progress * 100))}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const BUTTON = scale(52);
const BUTTON_LEFT = THEME.SPACE.XXL;
const MENU_LEFT = THEME.SPACE.XXL;
const MENU_WIDTH = scale(290);
const MENU_RADIUS = scale(28);

const styles = StyleSheet.create({
  dim: {
    backgroundColor: "rgba(8, 0, 20, 0.12)",
  },
  glass: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.COLORS.GLASS_RIM,
  },
  sheen: {
    backgroundColor: THEME.COLORS.GLASS_SHEEN,
  },
  button: {
    position: "absolute",
    zIndex: 2,
    left: BUTTON_LEFT,
    width: BUTTON,
    height: BUTTON,
  },
  buttonGlass: {
    flex: 1,
    borderRadius: BUTTON / 2,
  },
  buttonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The light the glass catches under the finger. */
  glint: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  menu: {
    position: "absolute",
    zIndex: 2,
    left: MENU_LEFT,
    width: MENU_WIDTH,
    transformOrigin: "left bottom",
  },
  menuGlass: {
    borderRadius: MENU_RADIUS,
    paddingVertical: THEME.SPACE.XS,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.LG,
    minHeight: scale(56),
    marginHorizontal: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.LG,
    paddingVertical: THEME.SPACE.SM,
    borderRadius: MENU_RADIUS - THEME.SPACE.XS,
  },
  itemPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.SUBHEAD,
    color: THEME.COLORS.TEXT,
  },
  itemHint: {
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    color: THEME.COLORS.TEXT_SOFT,
    marginTop: THEME.SPACE.XXS,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: THEME.SPACE.XS + THEME.SPACE.LG + THEME.ICON.LG + THEME.SPACE.LG,
    marginRight: THEME.SPACE.XS + THEME.SPACE.LG,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  sectionDivider: {
    height: THEME.SPACE.XS,
    marginVertical: THEME.SPACE.XXS,
    backgroundColor: "rgba(0, 0, 0, 0.16)",
  },
  progressTrack: {
    height: scale(3),
    marginHorizontal: THEME.SPACE.XL,
    marginBottom: THEME.SPACE.SM,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: THEME.COLORS.TEXT,
  },
});
