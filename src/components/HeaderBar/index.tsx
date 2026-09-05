import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { IMGS } from "../../i18n";
import { THEME } from "../../theme";
import { CONTAINER_HEIGHT, styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import {
  usePlayer,
  useTrackProgress,
} from "../../contexts/player/PlayerProvider";

interface Props {
  navigation: ReturnType<typeof useNavigation>;
  openLiveRequestModal?: () => void;
}

type Status = "playing" | "paused" | "changing";

const PULSE_OPACITY = 0.05;
const PULSE_DURATION = 1750;
const PULSE_TRAVEL = 50;
const PROGRESS_ANIM_DURATION = 1000;
const PROGRESS_RESET_DURATION = 300;

export function HeaderBar({ navigation, openLiveRequestModal }: Props) {
  const insets = useSafeAreaInsets();
  const progressAnim = useMemo(() => new Animated.Value(0), []); // Initial value for opacity: 0
  const [status, setStatus] = useState<Status>("playing");
  const player = usePlayer();
  const { currentTrackProgress } = useTrackProgress();
  const currentTrack = player.currentTrack;
  const currentProgram = player.currentProgram;

  useEffect(() => {
    if (
      currentTrackProgress &&
      currentTrack?.duration &&
      !Number.isNaN(currentTrackProgress) &&
      !Number.isNaN(currentTrack?.duration) &&
      currentTrack?.duration > 0 &&
      currentTrackProgress > 0 &&
      !Number.isNaN(currentTrackProgress / currentTrack?.duration)
    ) {
      Animated.timing(progressAnim, {
        toValue:
          Dimensions.get("window").width *
          (currentTrackProgress / currentTrack?.duration),
        duration: PROGRESS_ANIM_DURATION,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: PROGRESS_RESET_DURATION,
        useNativeDriver: false,
      }).start();
    }
  }, [progressAnim, currentTrack, currentTrackProgress]);

  const [animation] = useState(() => new Animated.Value(0));

  const startAnimation = () => {
      Animated.loop(
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
      ).start();
  };

  useEffect(() => {
    startAnimation();
    // Runs once on mount — the loop lives for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          onPress={() => {
            // @ts-ignore
            navigation.openDrawer();
          }}
        >
          <Image style={styles.menuBtn} source={menuIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            if (status === "changing") return;
            setStatus("changing");
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
            // @ts-ignore
            navigation.navigate("FazerPedido");
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
              {
                // width: Dimensions.get("window").width * currentTime,
                width: progressAnim,
              },
            ]}
          ></Animated.View>
        )}
    </View>
  );
}
