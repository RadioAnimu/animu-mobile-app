import { List, MusicNote } from "phosphor-react-native";
import { TouchableOpacity, View, Image, SafeAreaView } from "react-native";
import playButtonImage from "../../assets/play_square_btn.png";
import { THEME } from "../../theme";
import { styles } from "./styles";

export function HeaderBar() {
  return (
    <SafeAreaView style={styles.container}>
        <List size={28} color={THEME.COLORS.SHAPE} />
        <TouchableOpacity>
            <Image style={styles.playBtn} source={playButtonImage} />
        </TouchableOpacity>
        <MusicNote size={28} color={THEME.COLORS.SHAPE} weight="fill" />
    </SafeAreaView>
  );
}
