import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  TouchableOpacity,
  View,
} from "react-native";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { IMGS } from "../../languages";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { Track } from "../../core/domain/track";
import { Program } from "../../core/domain/program";

interface Props {
  navigation: ReturnType<typeof useNavigation>;
  openLiveRequestModal?: () => void;
  currentTrack?: Track;
  currentTrackProgress?: number | null;
  currentProgram?: Program;
}

type Status = "playing" | "paused" | "changing";

export function HeaderBar({
  navigation,
  openLiveRequestModal,
  currentTrack,
  currentTrackProgress,
  currentProgram,
}: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current; // Initial value for opacity: 0
  const [status, setStatus] = useState<Status>("playing");
  const player = usePlayer();

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
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [progressAnim, currentTrack, currentTrackProgress]);

  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    startAnimation();
  }, []);

  const startAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 0.05,
          duration: 1750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 1750,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, -50],
  });

  const { settings } = useUserSettings();

  const LiveRequestComponent = currentProgram?.acceptingRequests
    ? IMGS[settings.selectedLanguage].LIVE_REQUEST_ENABLED
    : IMGS[settings.selectedLanguage].LIVE_REQUEST_DISABLED;

  return (
    <View style={styles.view}>
      <View style={styles.container}>
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
                opacity: status === "changing" ? 0.5 : 1,
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
          style={{
            position: "relative",
          }}
        >
          {currentProgram?.isLive && openLiveRequestModal && (
            <Animated.View
              style={{
                transform: [{ translateY }],
                position: "absolute",
                right: 25,
                bottom: 48,
              }}
            >
              <LiveRequestComponent />
            </Animated.View>
          )}
          <Image style={styles.noteIcon} source={noteIcon} />
        </TouchableOpacity>
      </View>
      {!currentProgram?.isLive &&
        !currentTrack?.anime.toLocaleLowerCase().includes("passagem") && (
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
