import { TouchableOpacity, View, Image, SafeAreaView } from "react-native";
import playButtonImage from "../../assets/play_square_btn.png";
import pauseButtonImage from "../../assets/play_triangle_btn.png";
import { THEME } from "../../theme";
import { MyPlayerProps } from "../../utils";
import { styles } from "./styles";
import menuIcon from "../../assets/icons/menu.png";
import noteIcon from "../../assets/icons/note.png";

interface Props {
    player: MyPlayerProps;
}

export function HeaderBar({ player }: Props) {
  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}
