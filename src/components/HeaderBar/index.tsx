import { useNavigation } from "@react-navigation/native";
import { useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  TouchableOpacity,
  View,
} from "react-native";
import { AnimuInfoProps } from "../../api";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { MyPlayerProps } from "../../utils";
import { styles } from "./styles";
import { DICT, IMGS } from "../../languages";
import { UserSettingsContext } from "../../contexts/user.settings.context";

interface Props {
  player: MyPlayerProps;
  navigation: ReturnType<typeof useNavigation>;
  openLiveRequestModal: () => void;
}

type Status = "playing" | "paused" | "changing";

export function HeaderBar({ player, navigation, openLiveRequestModal }: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current; // Initial value for opacity: 0
  const [status, setStatus] = useState<Status>("playing");

  const [info, setAnimuInfo] = useState<AnimuInfoProps | null>(null);
  useEffect(() => {
    setInterval(() => {
      player.currentProgress = player.currentInformation?.track.timestart
        ? Date.now() - player.currentInformation?.track.timestart
        : 0;
      if (player.currentInformation) {
        setAnimuInfo({
          ...player.currentInformation,
          track: {
            ...player.currentInformation.track,
            progress: player.currentProgress,
          },
        });
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (
      info?.track?.progress &&
      info?.track?.duration &&
      !Number.isNaN(info?.track?.progress) &&
      !Number.isNaN(info?.track?.duration) &&
      info?.track?.duration > 0 &&
      info?.track?.progress > 0 &&
      !Number.isNaN(info?.track?.progress / info?.track?.duration)
    ) {
      Animated.timing(progressAnim, {
        toValue:
          Dimensions.get("window").width *
          (info?.track?.progress / info?.track?.duration),
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [progressAnim, info]);

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

  const { userSettings } = useContext(UserSettingsContext);

  const LiveRequestComponent =
    info?.program.pedidos_ao_vivo !== "no"
      ? IMGS[userSettings.selectedLanguage].LIVE_REQUEST_ENABLED
      : IMGS[userSettings.selectedLanguage].LIVE_REQUEST_DISABLED;

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
            if (player._paused) {
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
            source={player._paused ? pauseButtonImage : playButtonImage}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (
              info?.program?.isLiveProgram &&
              info?.program?.pedidos_ao_vivo !== "no"
            ) {
              openLiveRequestModal();
              return;
            } else if (info?.program?.isLiveProgram) {
              return;
            }
            // @ts-ignore
            navigation.navigate("FazerPedido");
          }}
          style={{
            position: "relative",
          }}
        >
          {info?.program?.isLiveProgram && (
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
      {!info?.program?.isLiveProgram &&
        !info?.track.anime.toLocaleLowerCase().includes("passagem") && (
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
