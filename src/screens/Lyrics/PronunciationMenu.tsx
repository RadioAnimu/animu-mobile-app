import { useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { Icon, type IconName } from "@/components/Icon";
import type { JapaneseDictionarySnapshot } from "@/core/japanese";
import type { PronunciationMode } from "@/core/lyrics/pronunciation";
import { useDict } from "@/hooks/useDict";
import type { Dict } from "@/i18n";
import { PronunciationIcon } from "@/screens/Lyrics/PronunciationIcon";
import { dictionarySize } from "@/screens/Settings/sections/dictionary-size";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";
import { haptics } from "@/utils/haptics";

/** The button's glass, and the tone cut into its icon. */
const GLASS = "rgba(255, 255, 255, 0.2)";
const CUTOUT = "#3a3346";

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
}

/**
 * Apple Music's lyrics menu: a round glass button bottom-left that opens a
 * menu of the pronunciations — romaji, hiragana, off — with the Japanese
 * dictionary offered (and its download shown) where a mode needs it.
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
}: Readonly<Props>) {
  const dict = useDict();
  const [open, setOpen] = useState(false);
  const bottom = bottomInset + THEME.SPACE.LG;

  const choose = (next: PronunciationMode) => {
    haptics.select();
    onSelect(next);
    setOpen(false);
  };

  const items: { mode: PronunciationMode; label: string; icon: IconName | "kana" }[] = [
    { mode: "romaji", label: dict.LYRICS_PRONUNCIATION_ROMAJI, icon: "abc" },
    { mode: "hiragana", label: dict.LYRICS_PRONUNCIATION_HIRAGANA, icon: "kana" },
    { mode: "off", label: dict.LYRICS_PRONUNCIATION_OFF, icon: "subtitles-off" },
  ];

  return (
    <>
      {open ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel={dict.A11Y_CLOSE}
          accessibilityRole="button"
        />
      ) : null}
      {open ? (
        <Animated.View
          entering={reduceMotion ? FadeIn.duration(150) : ZoomIn.springify().damping(18).stiffness(260)}
          exiting={reduceMotion ? FadeOut.duration(120) : ZoomOut.duration(140)}
          style={[styles.menu, { bottom: bottom + BUTTON + THEME.SPACE.SM }]}
          accessibilityRole="menu"
        >
          {items.map((item, index) => {
            const available = modes.includes(item.mode);
            const selected = available && item.mode === mode;
            return (
              <View key={item.mode}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <TouchableOpacity
                  accessibilityRole="menuitem"
                  accessibilityState={{ checked: selected, disabled: !available }}
                  accessibilityHint={available ? undefined : dict.LYRICS_DICTIONARY_NEEDED}
                  activeOpacity={THEME.OPACITY.PRESSED}
                  disabled={!available}
                  onPress={() => choose(item.mode)}
                  style={[styles.item, !available && styles.itemDisabled]}
                >
                  <ItemIcon icon={item.icon} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    {available ? null : <Text style={styles.itemHint}>{dict.LYRICS_DICTIONARY_NEEDED}</Text>}
                  </View>
                  {selected ? <Icon name="check" size={THEME.ICON.MD} color={THEME.COLORS.TEXT} /> : null}
                </TouchableOpacity>
              </View>
            );
          })}
          {dictionary.install === "installed" ? null : (
            <DictionaryItem dictionary={dictionary} onInstall={onInstall} onCancel={onCancelInstall} />
          )}
        </Animated.View>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={dict.LYRICS_PRONUNCIATION}
        accessibilityState={{ expanded: open }}
        activeOpacity={THEME.OPACITY.PRESSED}
        hitSlop={THEME.HIT_SLOP.SM}
        onPress={() => {
          haptics.tap();
          setOpen((value) => !value);
        }}
        style={[styles.button, { bottom }]}
      >
        <PronunciationIcon size={scale(28)} cutout={CUTOUT} />
      </TouchableOpacity>
    </>
  );
}

function ItemIcon({ icon }: Readonly<{ icon: IconName | "kana" }>) {
  if (icon === "kana") {
    return (
      <Text style={styles.kana} accessibilityElementsHidden importantForAccessibility="no">
        あ
      </Text>
    );
  }
  return <Icon name={icon} size={THEME.ICON.LG} color={THEME.COLORS.TEXT} />;
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
      <TouchableOpacity
        accessibilityRole="menuitem"
        accessibilityLabel={`${downloading ? dict.SETTINGS_JP_DICTIONARY_STOP : dict.SETTINGS_JP_DICTIONARY_ROW}, ${hint}`}
        activeOpacity={THEME.OPACITY.PRESSED}
        onPress={() => {
          haptics.tap();
          if (downloading) onCancel();
          else onInstall();
        }}
        style={styles.item}
      >
        <Icon name={downloading ? "close" : "download"} size={THEME.ICON.LG} color={THEME.COLORS.TEXT} />
        <View style={styles.itemText}>
          <Text style={styles.itemLabel}>
            {downloading ? dict.SETTINGS_JP_DICTIONARY_STOP : dict.SETTINGS_JP_DICTIONARY_ROW}
          </Text>
          <Text style={styles.itemHint}>{hint}</Text>
        </View>
      </TouchableOpacity>
      {downloading ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, Math.round(dictionary.progress * 100))}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const BUTTON = scale(52);

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    left: THEME.SPACE.XXL,
    width: BUTTON,
    height: BUTTON,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: GLASS,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    left: THEME.SPACE.LG,
    width: scale(290),
    borderRadius: scale(28),
    paddingVertical: THEME.SPACE.XS,
    backgroundColor: "rgba(58, 52, 70, 0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
    overflow: "hidden",
    transformOrigin: "left bottom",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.LG,
    minHeight: scale(56),
    paddingHorizontal: THEME.SPACE.XL,
    paddingVertical: THEME.SPACE.SM,
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
  kana: {
    width: THEME.ICON.LG,
    textAlign: "center",
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.ICON.MD,
    color: THEME.COLORS.TEXT,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: THEME.SPACE.XL + THEME.ICON.LG + THEME.SPACE.LG,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  sectionDivider: {
    height: THEME.SPACE.XS,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
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
