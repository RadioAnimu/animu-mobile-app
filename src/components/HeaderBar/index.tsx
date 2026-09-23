import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Animated, Easing, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import menuIcon from "@/assets/icons/menu.webp";
import noteIcon from "@/assets/icons/note.webp";
import playButtonImage from "@/assets/play_square_btn.webp";
import pauseButtonImage from "@/assets/play_triangle_btn.webp";
import { IMGS } from "@/i18n";
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
import { useSmoothedElapsed } from "@/hooks/useSmoothedElapsed";
import { isFillerTransition } from "@/core/domain/track";
import type { RootStackParamList } from "@/routes/app.routes";
import { haptics } from "@/utils/haptics";

interface Props {
  openLiveRequestModal?: () => void;
}

type Status = "playing" | "paused" | "changing";

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
const PULSE_TRAVEL = 50;
const PROGRESS_ANIM_DURATION = 300;
/**
 * A bar move larger than this snaps (setValue) instead of animating — a new
 * track resetting to 0, or the corrected position when synchronizing ends.
 * Only the small per-tick advance animates, so the bar never sweeps backwards.
 */
const BAR_SNAP_THRESHOLD = 0.03;

export function HeaderBar({ openLiveRequestModal }: Props) {
  const navigation =
    useNavigation<DrawerNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const [status, setStatus] = useState<Status>("playing");
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const currentTrack = player.currentTrack;
  const currentProgram = player.currentProgram;
  const isBackgrounded = useIsBackgrounded();
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
  const wasSyncing = useRef(player.syncing);

  useEffect(() => {
    const duration = currentTrack?.duration ?? 0;
    const hasProgress =
      smoothedElapsed != null &&
      Number.isFinite(smoothedElapsed) &&
      Number.isFinite(duration) &&
      duration > 0;

    const target = hasProgress
      ? Math.min(Math.max(smoothedElapsed / duration, 0), 1)
      : 0;

    const previous = lastBarTarget.current;
    lastBarTarget.current = target;
    const justSynced = wasSyncing.current && !syncing;
    wasSyncing.current = syncing;

    // Spotify-style: a big move — the next track resetting to 0, or the
    // corrected position once synchronizing finishes — SNAPS so the bar never
    // sweeps back. Only the slow per-tick advance animates.
    if (justSynced || Math.abs(target - previous) > BAR_SNAP_THRESHOLD) {
      progressAnim.setValue(target);
      return;
    }

    Animated.timing(progressAnim, {
      toValue: target,
      duration: PROGRESS_ANIM_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progressAnim, currentTrack, smoothedElapsed, syncing]);

  const showLiveBadge = Boolean(currentProgram?.isLive && openLiveRequestModal);

  useEffect(() => {
    // Only animate while the badge is actually rendered and visible.
    // Previously the loop started on mount and ran for the component's
    // whole lifetime, keeping the UI thread busy even when nothing was on
    // screen (and while backgrounded).
    if (!showLiveBadge || isBackgrounded) {
      animation.setValue(0);
      return;
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
  }, [showLiveBadge, isBackgrounded, animation]);

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [PULSE_TRAVEL, -PULSE_TRAVEL],
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
            onPress={() => {
              navigation.openDrawer();
            }}
          >
            <Image contentFit="contain" style={styles.menuBtn} source={menuIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              player.isPlaying ? dict.A11Y_PAUSE : dict.A11Y_PLAY
            }
            accessibilityState={{ disabled: status === "changing" }}
            onPress={async () => {
              if (status === "changing") return;
              setStatus("changing");
              haptics.tap();
              if (!player.isPlaying) {
                await player.play();
                setStatus("playing");
              } else {
                await player.pause();
                setStatus("paused");
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
              source={!player.isPlaying ? pauseButtonImage : playButtonImage}
            />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={dict.A11Y_MAKE_REQUEST}
            hitSlop={ICON_HIT_SLOP}
            onPress={() => {
              if (
                currentProgram?.isLive &&
                currentProgram?.acceptingRequests &&
                openLiveRequestModal
              ) {
                openLiveRequestModal();
                return;
              } else if (currentProgram?.isLive) {
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
