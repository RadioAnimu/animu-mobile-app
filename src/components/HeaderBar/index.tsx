import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Animated, Easing, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import menuIcon from "@/assets/icons/menu.webp";
import noteIcon from "@/assets/icons/note.webp";
// Named for the ACTION they afford, not the glyph: the square (pause bars)
// renders while PLAYING, the triangle renders while PAUSED. The file names
// ("play_square_btn" / "play_triangle_btn") describe the paused/play button
// pair, which reads backwards at the call site otherwise.
import pauseAffordanceImage from "@/assets/play_square_btn.webp";
import playAffordanceImage from "@/assets/play_triangle_btn.webp";
import { IMGS } from "@/i18n";
import { THEME } from "@/theme";
import { CONTAINER_HEIGHT, ICON_HIT_SLOP, MIC_SIZE, styles } from "@/components/HeaderBar/styles";
import { contentWidth } from "@/theme/responsive";
import { LyricsButton } from "@/components/LyricsButton";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { useBlink } from "@/hooks/useBlink";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { elapsedAt, progressRatio } from "@/utils/progress";
import type { DrawerParamList } from "@/routes/app.routes";
import { haptics } from "@/utils/haptics";

interface Props {
  openLiveRequestModal?: () => void;
}

type Status = "playing" | "paused" | "changing";

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
/** Resting vertical offset of the live badge; the pulse bobs it up and back. */
const PULSE_TRAVEL = 50;
const PULSE_BOB = PULSE_TRAVEL * 2 * PULSE_OPACITY;

export function HeaderBar({ openLiveRequestModal }: Readonly<Props>) {
  const navigation =
    useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const player = usePlayer();
  const isBackgrounded = useIsBackgrounded();
  const reduceMotion = useReducedMotion();
  const { currentTrack, currentProgram } = player;
  const progress = useTrackProgress();
  const { progressMs, progressAt, progressRunning, showProgress } = progress;
  const duration = currentTrack?.duration ?? 0;
  // The bar spawns AT the live ratio (cold start, screen switch, thaw after
  // a background freeze) — no first frame at 0 that then snaps forward.
  const [progressAnim] = useState(() =>
    new Animated.Value(
      progressRatio(elapsedAt(progress, duration, Date.now()), duration),
    ),
  );
  const [status, setStatus] = useState<Status>("playing");
  /** Still locking the audible clock — the bar is a guess until then. */
  const syncing = player.syncing;

  const [animation] = useState(() => new Animated.Value(0));

  // Pulse the bar while the audible clock is still being measured, so a
  // wrong/empty position reads as "working on it" instead of broken. Stops
  // (and resets to full opacity) the moment sync lands or the app hides.
  const syncBlink = useBlink(syncing && showProgress && !isBackgrounded);

  /** Re-entrancy guard: two taps in one frame must not toggle twice. */
  const changingRef = useRef(false);

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

  // The row follows the current window (Android 16 may resize the app on
  // tablets), keeping the icons aligned with the page column.
  const { width: windowWidth } = useWindowDimensions();

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
          },
        ]}
      >
        <View style={[styles.row, { width: contentWidth(windowWidth) }]}>
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
          <TouchableOpacity
            activeOpacity={THEME.OPACITY.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={
              player.isPlaying ? dict.A11Y_PAUSE : dict.A11Y_PLAY
            }
            accessibilityState={{ disabled: status === "changing" }}
            onPress={async () => {
              if (changingRef.current) return;
              changingRef.current = true;
              setStatus("changing");
              haptics.tap();
              // Capture the pre-toggle truth: after the await the render
              // closure's `player.isPlaying` is stale (the store moved, this
              // render did not), so re-reading it would report the WRONG
              // state. On failure revert to that same truth; the provider
              // already logs, the catch is the defensive backstop.
              const wasPlaying = player.isPlaying;
              try {
                if (wasPlaying) {
                  await player.pause();
                } else {
                  await player.play();
                }
                setStatus(wasPlaying ? "paused" : "playing");
              } catch (error) {
                console.warn("[HeaderBar] play/pause failed:", error);
                setStatus(wasPlaying ? "playing" : "paused");
              } finally {
                changingRef.current = false;
              }
            }}
          >
            <Image
              contentFit="contain"
              style={[
                styles.playBtn,
                {
                  opacity: status === "changing" ? THEME.OPACITY.DISABLED : 1,
                },
              ]}
              source={!player.isPlaying ? playAffordanceImage : pauseAffordanceImage}
            />
          </TouchableOpacity>

          {/* The microphone sits left of the note without joining the row's
              flex, so the play button stays centered. */}
          <View style={styles.noteSlot}>
            <LyricsButton size={MIC_SIZE} hitSlop={ICON_HIT_SLOP / 2} style={styles.lyricsButton} />
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
