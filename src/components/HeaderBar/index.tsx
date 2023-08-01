import { TouchableOpacity, View, Image, Dimensions } from "react-native";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { MyPlayerProps } from "../../utils";
import { styles } from "./styles";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";

interface Props {
  player: MyPlayerProps;
}

export function HeaderBar({ player }: Props) {
  const currentTime = player.currentMusic?.track.timestart
    ? Date.now() - player.currentMusic?.track.timestart > 0
      ? (Date.now() - player.currentMusic?.track.timestart) /
        player.currentMusic?.track.duration
      : 0
    : 0;
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
        <Image style={styles.noteIcon} source={noteIcon} />
      </View>
      {!player.currentMusic?.track.isLiveProgram && (
        <View style={[styles.progressBarView, {
                width: Dimensions.get("window").width * currentTime,
            }]}>
        </View>
      )}
    </View>
  );
}
