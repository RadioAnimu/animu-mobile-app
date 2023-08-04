import { ActivityIndicator, ImageBackground } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { SafeAreaView } from "react-native-safe-area-context";
import { Background } from "../../components/Background";
import splashScreenImage from "../../../assets/splash_top.png";

export function Loading() {
  return (
    <Background>
      <SafeAreaView style={styles.container}>
        <ImageBackground
          defaultSource={splashScreenImage}
          source={splashScreenImage}
          style={{
            flex: 1,
            flexDirection: "column-reverse",
            paddingBottom: "40%",
          }}
        >
          <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
        </ImageBackground>
      </SafeAreaView>
    </Background>
  );
}
