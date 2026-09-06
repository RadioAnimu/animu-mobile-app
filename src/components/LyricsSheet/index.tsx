import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Cover } from "../Cover";
import { Marquee, MarqueeGroup } from "../Marquee";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useLyrics } from "../../contexts/lyrics/LyricsProvider";
import { lyricsService } from "../../core/lyrics";
import { trackStartMs } from "../../core/lyrics/clock";
import type { LyricLine } from "../../core/lyrics/types";
import {
  japaneseDictionaryManager,
  useJapaneseDictionary,
} from "../../core/japanese";
import { useActiveLineIndex } from "../../hooks/useKaraoke";
import { LyricRow, type LyricLabelMode } from "./LyricRow";
import { styles } from "./styles";

// ─── Lyrics overlay ───
//
// Apple-Music-style full-screen karaoke: the active line is bright and
// word-highlighted, past lines dim out, future lines stay readable, and
// the list follows the song with a centered active line. Japanese lines
// carry a pronunciation label — the header button cycles Off → Romaji →
// Hiragana (hiragana joins the cycle once the offline dictionary is
// installed, since kanji readings need it).

const AUTO_SCROLL_RESUME_MS = 4_000;

const LABEL_MODES_WITHOUT_DICT: LyricLabelMode[] = ["off", "romaji"];
const LABEL_MODES_WITH_DICT: LyricLabelMode[] = ["off", "romaji", "hiragana"];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LyricsSheet({ visible, onClose }: Props) {
  const lyrics = useLyrics();
  const player = usePlayer();
  const { settings } = useUserSettings();
  const insets = useSafeAreaInsets();
  const dictionary = useJapaneseDictionary();

  const [labelMode, setLabelMode] = useState<LyricLabelMode>("romaji");
  const track = player.currentTrack;
  const dict = DICT[settings.selectedLanguage];
  const { height: windowHeight } = useWindowDimensions();

  const dictReady = dictionary.download === "ready";
  const labelsReady = dictionary.tokenizer === "ready";
  const labelModes = dictReady ? LABEL_MODES_WITH_DICT : LABEL_MODES_WITHOUT_DICT;

  // Heavy kuromoji parse — kicked off only while reading a Japanese
  // song, and only after the user has the dictionary on disk.
  useEffect(() => {
    if (
      visible &&
      lyrics.language === "ja" &&
      dictReady &&
      dictionary.tokenizer === "idle"
    ) {
      void japaneseDictionaryManager.ensureTokenizer();
    }
  }, [visible, lyrics.language, dictReady, dictionary.tokenizer]);

  const cycleLabelMode = useCallback(() => {
    setLabelMode((mode) => {
      const next = labelModes[(labelModes.indexOf(mode) + 1) % labelModes.length];
      return next;
    });
  }, [labelModes]);

  const listPaddings = useMemo(
    () => ({
      paddingTop: windowHeight * 0.42,
      paddingBottom: windowHeight * 0.48,
    }),
    [windowHeight],
  );

  const karaoke = lyrics.status === "found";
  const plain = lyrics.status === "plain";
  const startTimeMs = trackStartMs(track);

  const activeIndex = useActiveLineIndex(
    lyrics.lines,
    { startTimeMs, isPlaying: player.isPlaying },
    visible && karaoke,
  );

  // ─── Auto-follow with a scroll takeover window ───
  const listRef = useRef<FlatList>(null);
  const userScrollingRef = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resumeTick, setResumeTick] = useState(0);

  useEffect(() => {
    if (!visible || !karaoke) return;
    if (userScrollingRef.current) return;
    if (activeIndex < 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    listRef.current?.scrollToIndex({
      index: activeIndex,
      viewPosition: 0.5,
      animated: true,
    });
    // resumeTick re-fires this once the user's scroll-takeover window ends
  }, [activeIndex, lyrics.trackKey, resumeTick, visible, karaoke]);

  const beginUserScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const endUserScroll = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      userScrollingRef.current = false;
      setResumeTick((tick) => tick + 1);
    }, AUTO_SCROLL_RESUME_MS);
  }, []);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const offset = Math.max(0, info.averageItemLength * info.index);
      listRef.current?.scrollToOffset({ offset, animated: true });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          viewPosition: 0.5,
          animated: true,
        });
      }, 220);
    },
    [],
  );

  const retry = useCallback(() => {
    void lyricsService.retry();
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: LyricLine; index: number }) => (
      <LyricRow
        line={item}
        isActive={karaoke && index === activeIndex}
        isPast={karaoke && activeIndex >= 0 && index < activeIndex}
        plain={plain}
        labelMode={labelMode}
        startTimeMs={startTimeMs}
        isPlaying={player.isPlaying}
      />
    ),
    [karaoke, activeIndex, plain, labelMode, startTimeMs, player.isPlaying],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: THEME.COLORS.BG_DEEP }]}>
        <View style={[styles.header, { paddingTop: insets.top + THEME.SPACE.MD }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel={dict.LYRICS_CLOSE}
          >
            <Ionicons name="chevron-down" size={26} color={THEME.COLORS.TEXT} />
          </TouchableOpacity>

          {track?.artwork ? (
            <Cover cover={track.artwork} style={styles.thumbnail} />
          ) : null}

          <View style={styles.trackInfo}>
            <MarqueeGroup>
              <Marquee style={styles.trackTitle} text={track?.title ?? ""} />
              <Marquee style={styles.trackArtist} text={track?.artist ?? ""} />
            </MarqueeGroup>
          </View>

          {lyrics.language === "ja" && (
            <TouchableOpacity
              style={[
                styles.romajiToggle,
                labelMode !== "off" && styles.romajiToggleOn,
              ]}
              onPress={cycleLabelMode}
              accessibilityLabel={
                labelMode === "hiragana" ? dict.LYRICS_HIRAGANA : dict.LYRICS_ROMAJI
              }
            >
              <Text
                style={[
                  styles.romajiToggleLabel,
                  labelMode !== "off" && styles.romajiToggleLabelOn,
                ]}
              >
                {labelMode === "hiragana" ? "あ" : "Aa"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          {(lyrics.status === "idle" || lyrics.status === "not-found") && (
            <StateMessage
              icon="search-outline"
              message={dict.LYRICS_NOT_FOUND}
              hint={lyrics.status === "not-found" ? dict.LYRICS_NOT_FOUND_HINT : undefined}
              retryLabel={lyrics.status === "not-found" ? dict.LYRICS_RETRY : undefined}
              onRetry={lyrics.status === "not-found" ? retry : undefined}
            />
          )}

          {lyrics.status === "loading" && (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={THEME.COLORS.BRAND} />
            </View>
          )}

          {lyrics.status === "instrumental" && (
            <StateMessage
              icon="musical-notes-outline"
              message={dict.LYRICS_INSTRUMENTAL}
            />
          )}

          {lyrics.status === "error" && (
            <StateMessage
              icon="cloud-offline-outline"
              message={dict.LYRICS_ERROR}
              retryLabel={dict.LYRICS_RETRY}
              onRetry={retry}
            />
          )}

          {(karaoke || plain) && (
            <FlatList
              ref={listRef}
              data={lyrics.lines}
              keyExtractor={(_, index) => String(index)}
              renderItem={renderItem}
              onScrollBeginDrag={beginUserScroll}
              onMomentumScrollEnd={endUserScroll}
              onScrollEndDrag={endUserScroll}
              onScrollToIndexFailed={onScrollToIndexFailed}
              extraData={`${labelMode}:${labelsReady}`}
              contentContainerStyle={[styles.listContent, listPaddings]}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={14}
              maxToRenderPerBatch={10}
              windowSize={9}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

interface StateMessageProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  message: string;
  hint?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

function StateMessage({ icon, message, hint, retryLabel, onRetry }: StateMessageProps) {
  return (
    <View style={styles.stateContainer}>
      <Ionicons name={icon} size={42} color={THEME.COLORS.TEXT_DIM} />
      <Text style={styles.stateMessage}>{message}</Text>
      {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
      {retryLabel && onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryLabel}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
