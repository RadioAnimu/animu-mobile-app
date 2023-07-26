import { TouchableOpacity, View, Image } from "react-native";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { THEME } from "../../theme";
import { MyPlayerProps } from "../../utils";
import { styles } from "./styles";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";
import Slider from '@react-native-community/slider';

interface Props {
    player: MyPlayerProps;
}

export function HeaderBar({ player }: Props) {
  const currentTime = player.curretnMusic?.track.timestart ? ((Date.now() - player.curretnMusic?.track.timestart) > 0 ? (Date.now() - player.curretnMusic?.track.timestart) / player.curretnMusic?.track.duration : 0) : 0;
  console.log({ currentTime });
  return (
    <View style={styles.view}>
        <View style={styles.container}>
            <Image style={styles.menuBtn} source={menuIcon} />
            <TouchableOpacity onPress={() => {
                if (player._paused) {
                    player.play();
                } else {
                    player.pause();
                }}}>
                <Image style={styles.playBtn} source={player._paused ? pauseButtonImage : playButtonImage} />
            </TouchableOpacity>
            <Image style={styles.noteIcon} source={noteIcon} />
        </View>
        <View style={styles.progressBarView}>
            <Slider
              value={currentTime}
              style={styles.progressBar}
              tapToSeek={false}
              minimumValue={0}
              maximumValue={1}
              minimumTrackTintColor={THEME.COLORS.SHAPE}
              thumbTintColor="transparent"
              maximumTrackTintColor="transparent"
            />
        </View>
    </View>
  );
}
