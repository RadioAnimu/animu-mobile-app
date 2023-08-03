import {
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { MyPlayerProps } from "../../utils";
import { styles } from "./styles";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";
import { useEffect, useRef } from "react";
import { AnimuInfoProps } from "../../api";

interface Props {
  player: MyPlayerProps;
  info: AnimuInfoProps | null;
}

export function HeaderBar({ player, info }: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current; // Initial value for opacity: 0

  useEffect(() => {
    if (
      info?.track?.progress &&
      info?.track?.duration &&
      !isNaN(info?.track?.progress) &&
      !isNaN(info?.track?.duration) &&
      info?.track?.duration > 0 &&
      info?.track?.progress > 0 &&
      !isNaN(info?.track?.progress / info?.track?.duration)
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
            player._oscilloscopeEnabled = !player._oscilloscopeEnabled;
          }}
        >
          <Image style={styles.menuBtn} source={menuIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (player._paused) {
              player.play();
            } else {
              player.pause();
            }
          }}
        >
          <Image
            style={styles.playBtn}
            source={player._paused ? pauseButtonImage : playButtonImage}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={player.openPedidosURL}>
          <Image style={styles.noteIcon} source={noteIcon} />
        </TouchableOpacity>
      </View>
      {!player?.currentMusic?.program?.isLiveProgram && (
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
