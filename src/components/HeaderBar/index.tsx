import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import menuIcon from "@/assets/icons/menu.png";
import noteIcon from "@/assets/icons/note.png";
import playButtonImage from "@/assets/play_square_btn.png";
import pauseButtonImage from "@/assets/play_triangle_btn.png";
import { IMGS } from "@/i18n";
import { THEME } from "@/theme";
import { CONTAINER_HEIGHT, ICON_HIT_SLOP, styles } from "@/components/HeaderBar/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import {
  usePlayer,
  useTrackProgress,
} from "@/contexts/player/PlayerProvider";
import { useIsBackgrounded } from "@/contexts/app-state/AppStateProvider";
import type { RootStackParamList } from "@/routes/app.routes";
import { haptics } from "@/utils/haptics";

interface Props {
  openLiveRequestModal?: () => void;
}

type Status = "playing" | "paused" | "changing";

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
const PULSE_TRAVEL = 50;
const PROGRESS_ANIM_DURATION = 1000;

export function HeaderBar({ openLiveRequestModal }: Props) {
  const navigation =
    useNavigation<DrawerNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const [status, setStatus] = useState<Status>("playing");
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const currentTrack = player.currentTrack;
  const currentProgram = player.currentProgram;
  const isBackgrounded = useIsBackgrounded();

  useEffect(() => {
    const duration = currentTrack?.duration ?? 0;
    const hasProgress =
      currentTrackProgress != null &&
      Number.isFinite(currentTrackProgress) &&
      Number.isFinite(duration) &&
      duration > 0;

    const target = hasProgress
      ? Math.min(Math.max(currentTrackProgress / duration, 0), 1)
      : 0;

    // Native-driven `scaleX` (not `width`): the bar interpolates smoothly
    // across each 1 Hz progress tick on the UI thread, so it never runs
    // per-frame JS and pauses on its own when the app is backgrounded.
    Animated.timing(progressAnim, {
      toValue: target,
      duration: PROGRESS_ANIM_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progressAnim, currentTrack, currentTrackProgress]);

  const [animation] = useState(() => new Animated.Value(0));

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
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={ICON_HIT_SLOP}
          onPress={() => {
            navigation.openDrawer();
          }}
        >
          <Image style={styles.menuBtn} source={menuIcon} />
        </TouchableOpacity>
        <TouchableOpacity
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
          accessibilityLabel="Make a request"
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
          <Image style={styles.noteIcon} source={noteIcon} />
        </TouchableOpacity>
      </View>
      {!currentProgram?.isLive &&
        !currentTrack?.anime?.toLocaleLowerCase().includes("passagem") && (
          <Animated.View
            style={[
              styles.progressBarView,
              { transform: [{ scaleX: progressAnim }] },
            ]}
          />
        )}
    </View>
  );
}
