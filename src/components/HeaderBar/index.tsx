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
  const currentTime = player.currentMusic?.track.timestart
    ? Date.now() - player.currentMusic?.track.timestart > 0
      ? (Date.now() - player.currentMusic?.track.timestart) /
        player.currentMusic?.track.duration
      : 0
    : 0;

  const progressAnim = useRef(new Animated.Value(0)).current; // Initial value for opacity: 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Dimensions.get("window").width * currentTime,
      duration: 10000,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, info]);

  return (
    <View style={styles.view}>
      <View style={styles.container}>
        <Image style={styles.menuBtn} source={menuIcon} />
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
