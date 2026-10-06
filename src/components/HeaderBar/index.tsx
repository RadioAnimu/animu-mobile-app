import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
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
import { MOTION } from "@/theme/motion";
import { THEME } from "@/theme";
import { CONTAINER_HEIGHT, ICON_HIT_SLOP, styles } from "@/components/HeaderBar/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import { useDict } from "@/hooks/useDict";
import { useBlink } from "@/hooks/useBlink";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSmoothedElapsed } from "@/hooks/useSmoothedElapsed";
import { isFillerTransition } from "@/core/domain/track";
import {
  progressRatio,
  isBarCorrection,
  isSubVisibleStep,
} from "@/utils/progress";
import type { DrawerParamList } from "@/routes/app.routes";
import type { Program } from "@/core/domain/program";
import { usePlaybackToggle } from "@/hooks/usePlaybackToggle";

interface Props {
  openLiveRequestModal?: () => void;
}

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
/** Resting vertical offset of the live badge; the pulse bobs it up and back. */
const PULSE_TRAVEL = 50;
const PULSE_BOB = PULSE_TRAVEL * 2 * PULSE_OPACITY;
const PROGRESS_ANIM_DURATION = MOTION.DURATION.SLOW;

/** One availability decision drives the action, disabled state and tint. */
function requestDestination(program: Program | undefined, canOpenLive: boolean) {
  if (!program?.isLive) return "search";
  return program.acceptingRequests && canOpenLive ? "live" : "closed";
}

function PlaybackButton({ isPlaying, changing, onPress }: Readonly<{
  isPlaying: boolean;
  changing: boolean;
  onPress: () => void;
}>) {
  const dict = useDict();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? dict.A11Y_PAUSE : dict.A11Y_PLAY}
      activeOpacity={THEME.OPACITY.PRESSED}
      disabled={changing}
      accessibilityState={{ disabled: changing, busy: changing }}
      onPress={onPress}
    >
      <Image
        contentFit="contain"
        style={[styles.playBtn, { opacity: changing ? THEME.OPACITY.DISABLED : 1 }]}
        source={isPlaying ? pauseAffordanceImage : playAffordanceImage}
      />
    </TouchableOpacity>
  );
}

export function HeaderBar({ openLiveRequestModal }: Readonly<Props>) {
  const navigation =
    useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const player = usePlayer();
  const isBackgrounded = useIsBackgrounded();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();
  const { currentTrack, currentProgram } = player;
  const requestAction = requestDestination(currentProgram, Boolean(openLiveRequestModal));
  const requestsClosed = requestAction === "closed";
  const { currentTrackProgress } = useTrackProgress();
  // The bar spawns AT the live ratio (cold start, screen switch, thaw after
  // a background freeze) — no first frame at 0 that then snaps forward.
  const [progressAnim] = useState(() =>
    new Animated.Value(
      progressRatio(currentTrackProgress, currentTrack?.duration),
    ),
  );
  const { changing, toggle } = usePlaybackToggle(player);
  // Smoothed so the bar advances continuously between the ~1 Hz updates
  // instead of stuttering on a late/jittery progress value.
  const smoothedElapsed = useSmoothedElapsed(
    currentTrackProgress,
    currentTrack?.raw,
  );
  /** Still locking the audible clock — the bar is a guess until then. */
  const syncing = player.syncing;
  const showProgressBar =
    !currentProgram?.isLive && !isFillerTransition(currentTrack);

  const [animation] = useState(() => new Animated.Value(0));

  // Pulse the bar while the audible clock is still being measured, so a
  // wrong/empty position reads as "working on it" instead of broken. Stops
  // (and resets to full opacity) the moment sync lands or the app hides.
  const syncBlink = useBlink(syncing && showProgressBar && !isBackgrounded);

  // Last bar target, to tell a real jump (new track / sync completed) from the
  // small per-tick advance.
  const lastBarTarget = useRef(0);
  const lastBarRun = useRef(0);
  const wasSyncing = useRef(player.syncing);

  useEffect(() => {
    const duration = currentTrack?.duration ?? 0;
    const hasProgress =
      smoothedElapsed != null &&
      Number.isFinite(smoothedElapsed) &&
      Number.isFinite(duration) &&
      duration > 0;

    const target = hasProgress ? progressRatio(smoothedElapsed, duration) : 0;

    const previous = lastBarTarget.current;
    lastBarTarget.current = target;
    const nowMs = Date.now();
    const sinceEffect = lastBarRun.current ? nowMs - lastBarRun.current : 0;
    lastBarRun.current = nowMs;
    const justSynced = wasSyncing.current && !syncing;
    wasSyncing.current = syncing;

    // Spotify-style: a move bigger than real playback could have produced
    // since the last render — the next track resetting to 0, or the
    // corrected position once synchronizing finishes — SNAPS so the bar
    // never sweeps back. Normal per-tick advances animate, which keeps
    // short tracks smooth along with long ones.
    if (justSynced || isBarCorrection(target - previous, sinceEffect, duration)) {
      progressAnim.setValue(target);
      return;
    }

    // A sub-pixel advance (long track) is set directly: tweening it would
    // keep a native animation in flight nonstop for no visible gain.
    if (isSubVisibleStep(target - previous, windowWidth)) {
      progressAnim.setValue(target);
      return;
    }

    Animated.timing(progressAnim, {
      toValue: target,
      duration: PROGRESS_ANIM_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progressAnim, currentTrack, smoothedElapsed, syncing, windowWidth]);

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
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_OPEN_MENU}
            hitSlop={ICON_HIT_SLOP}
            activeOpacity={THEME.OPACITY.PRESSED}
            onPress={() => {
              navigation.openDrawer();
            }}
          >
            <Image contentFit="contain" style={styles.menuBtn} source={menuIcon} />
          </TouchableOpacity>
          <PlaybackButton isPlaying={player.isPlaying} changing={changing} onPress={() => void toggle()} />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_MAKE_REQUEST}
            hitSlop={ICON_HIT_SLOP}
            activeOpacity={THEME.OPACITY.PRESSED}
            disabled={requestsClosed}
            accessibilityState={{ disabled: requestsClosed }}
            onPress={() => {
              if (requestAction === "live") {
                openLiveRequestModal?.();
                return;
              }
              if (requestAction === "search") navigation.navigate("MakeRequest");
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
            <Image contentFit="contain" style={[styles.noteIcon, requestsClosed && { opacity: THEME.OPACITY.DISABLED }]} source={noteIcon} />
          </TouchableOpacity>
        </View>
      </View>
      {showProgressBar && (
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
  );
}
