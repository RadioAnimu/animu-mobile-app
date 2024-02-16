import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
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
import { useNavigation } from "@react-navigation/native";

interface Props {
  player: MyPlayerProps;
  navigation: ReturnType<typeof useNavigation>;
  info: AnimuInfoProps | null;
}

type Status = "playing" | "paused" | "changing";

export function HeaderBar({ player, info, navigation }: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current; // Initial value for opacity: 0
  const [status, setStatus] = useState<Status>("playing");

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
        <TouchableOpacity onPress={player.openPedidosURL}>
          <Image style={styles.noteIcon} source={noteIcon} />
        </TouchableOpacity>
      </View>
      {!info?.program?.isLiveProgram && (
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
