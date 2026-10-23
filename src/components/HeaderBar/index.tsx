import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Animated, Easing, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import menuIcon from "@/assets/icons/menu.webp";
import noteIcon from "@/assets/icons/note.webp";
import { IMGS } from "@/i18n";
import { THEME } from "@/theme";
import {
  CONTAINER_HEIGHT,
  ICON_HIT_SLOP,
  MIC_SIZE,
  micOffset,
  playButtonMargin,
  styles,
} from "@/components/HeaderBar/styles";
import { contentWidth } from "@/theme/responsive";
import { LyricsButton } from "@/components/LyricsButton";
import { PlayPauseButton } from "@/components/PlayPauseButton";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { useBlink } from "@/hooks/useBlink";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { elapsedAt, progressRatio } from "@/utils/progress";
import type { DrawerParamList } from "@/routes/app.routes";

interface Props {
  openLiveRequestModal?: () => void;
  /**
   * Width of the icon row. Defaults to the page column of the usable window;
   * the split layout passes its two-pane content width so the icons line up
   * with the panes beneath.
   */
  rowWidth?: number;
}

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
/** Resting vertical offset of the live badge; the pulse bobs it up and back. */
const PULSE_TRAVEL = 50;
const PULSE_BOB = PULSE_TRAVEL * 2 * PULSE_OPACITY;

export function HeaderBar({ openLiveRequestModal, rowWidth }: Readonly<Props>) {
  const navigation =
    useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const player = usePlayer();
  const isBackgrounded = useIsBackgrounded();
  const reduceMotion = useReducedMotion();
  const { currentProgram } = player;
  const progress = useTrackProgress();
  const { progressMs, progressAt, progressRunning, showProgress } = progress;
  const duration = progress.durationMs;
  // The bar spawns AT the live ratio (cold start, screen switch, thaw after
  // a background freeze) — no first frame at 0 that then snaps forward.
  const [progressAnim] = useState(() =>
    new Animated.Value(
      progressRatio(elapsedAt(progress, duration, Date.now()), duration),
    ),
  );
  /** Still locking the audible clock — the bar is a guess until then. */
  const syncing = player.syncing;

  const [animation] = useState(() => new Animated.Value(0));

  // Pulse the bar while the audible clock is still being measured, so a
  // wrong/empty position reads as "working on it" instead of broken. Stops
  // (and resets to full opacity) the moment sync lands or the app hides.
  const syncBlink = useBlink(syncing && showProgress && !isBackgrounded);

  // The position is a real-time anchor, so the bar runs optimistically: placed
  // at the live ratio, then ONE linear native animation to the song's end.
  // Nothing re-drives it per second — only a re-anchor (new song, sync locked,
  // pause / resume) restarts it, from exactly where the audio is.
  useEffect(() => {
    const anchor = { progressMs, progressAt, progressRunning };
    const elapsed = elapsedAt(anchor, duration, Date.now());
    const ratio = progressRatio(elapsed, duration);
    progressAnim.setValue(ratio);
    if (elapsed == null || !progressRunning || isBackgrounded || ratio >= 1) {
      return undefined;
    }
    const run = Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration - elapsed,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [progressAnim, progressMs, progressAt, progressRunning, duration, isBackgrounded]);

  const showLiveBadge = Boolean(currentProgram?.isLive && openLiveRequestModal);

  useEffect(() => {
    // Only animate while the badge is actually rendered and visible.
    // Previously the loop started on mount and ran for the component's
    // whole lifetime, keeping the UI thread busy even when nothing was on
    // screen (and while backgrounded).
    // Purely decorative and endless, so Reduce Motion parks it at rest.
    if (!showLiveBadge || isBackgrounded || reduceMotion) {
      animation.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: PULSE_OPACITY,
          duration: PULSE_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: PULSE_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      animation.setValue(0);
    };
  }, [showLiveBadge, isBackgrounded, reduceMotion, animation]);

  const translateY = animation.interpolate({
    inputRange: [0, PULSE_OPACITY],
    outputRange: [PULSE_TRAVEL, PULSE_TRAVEL - PULSE_BOB],
  });

  const { settings } = useUserSettings();

  // The row follows the live window (rotation, split view, Android
  // multi-window), inside the side safe areas — the notch of a landscape
  // phone is not room for icons — keeping them aligned with the page column.
  const { usableWidth, tv, windowControlsInset } = useResponsiveLayout();
  // In an iPadOS window the row must start past the window controls. A
  // centered row that already clears them stays centered over the page; one
  // that would reach under them (a narrow window's full-width row) gives up
  // just enough of its leading room.
  const baseWidth = rowWidth ?? contentWidth(usableWidth);
  const controlsLead = Math.max(0, windowControlsInset - (usableWidth - baseWidth) / 2);
  const width = Math.min(baseWidth, usableWidth - controlsLead);
  const playMargin = playButtonMargin(width);
  const micByMenu = { left: micOffset(width) };
  const micByNote = { right: micOffset(width) };

  const LiveRequestComponent = currentProgram?.acceptingRequests
    ? IMGS[settings.selectedLanguage].LIVE_REQUEST_ENABLED
    : IMGS[settings.selectedLanguage].LIVE_REQUEST_DISABLED;

  return (
    <View style={styles.view}>
      <View
        style={[
          styles.container,
          {
            height: CONTAINER_HEIGHT + insets.top,
            paddingTop: insets.top,
            // The bar runs under a landscape notch / cutout; its row does not.
            paddingLeft: insets.left + controlsLead,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={[styles.row, { width }]}>
          {/* The microphone never joins the row's flex, so the play button
              stays centered wherever it hangs. Live shows dangle the
              live-request badge over the note — right where a note-side mic
              would sit — so during a live program the mic parks beside the
              menu instead (menu·mic, play, note). */}
          <View style={styles.menuSlot} testID="menu-slot">
            <TouchableOpacity
              activeOpacity={THEME.OPACITY.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_OPEN_MENU}
              hitSlop={ICON_HIT_SLOP}
              onPress={() => {
                navigation.openDrawer();
              }}
            >
              <Image contentFit="contain" style={styles.menuBtn} source={menuIcon} />
            </TouchableOpacity>
            {showLiveBadge && (
              <LyricsButton
                size={MIC_SIZE}
                hitSlop={ICON_HIT_SLOP / 2}
                style={[styles.lyricsButtonByMenu, micByMenu]}
              />
            )}
          </View>
          <PlayPauseButton
            style={[styles.playBtn, { marginHorizontal: playMargin }]}
            hasTVPreferredFocus={tv}
          />

          {/* Fallback placement: away from a live badge the mic hangs off the
              note's left, as before. Only one mic mounts at a time — the two
              branches swap it between slots. */}
          <View style={styles.noteSlot} testID="note-slot">
            {!showLiveBadge && (
              <LyricsButton
                size={MIC_SIZE}
                hitSlop={ICON_HIT_SLOP / 2}
                style={[styles.lyricsButtonByNote, micByNote]}
              />
            )}
            <TouchableOpacity
              activeOpacity={THEME.OPACITY.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_MAKE_REQUEST}
              hitSlop={ICON_HIT_SLOP}
              onPress={() => {
                if (currentProgram?.isLive) {
                  // Live: requests go through the modal, or nowhere while closed.
                  if (currentProgram.acceptingRequests && openLiveRequestModal) {
                    openLiveRequestModal();
                  }
                  return;
                }
                navigation.navigate("MakeRequest");
              }}
              style={styles.noteWrapper}
            >
              {currentProgram?.isLive && openLiveRequestModal && (
                <Animated.View
                  style={[
                    styles.liveRequestBadge,
                    { transform: [{ translateY }] },
                  ]}
                >
                  <LiveRequestComponent />
                </Animated.View>
              )}
              <Image contentFit="contain" style={styles.noteIcon} source={noteIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* The slot is always there: live shows and jingles have no bar, and
          dropping its height used to nudge the whole player up and down. */}
      <View
        style={styles.progressSlot}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {showProgress && (
          <Animated.View
            style={[
              styles.progressBarView,
              syncing && styles.progressBarSyncing,
              {
                opacity: syncing ? syncBlink : 1,
                // Unknown position while syncing → show the full muted bar
                // pulsing rather than a stale/0 progress.
                transform: [{ scaleX: syncing ? 1 : progressAnim }],
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}
