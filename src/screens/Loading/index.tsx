import { ActivityIndicator, ImageBackground, StyleSheet } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { SafeAreaView } from "react-native-safe-area-context";
import splashScreenImage from "../../../assets/splash_top.png";

const BOTTOM_INSET = "40%";

const splashStyles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: BOTTOM_INSET,
  },
});

export function Loading() {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ImageBackground
        defaultSource={splashScreenImage}
        source={splashScreenImage}
        style={splashStyles.background}
      >
        <ActivityIndicator color={THEME.COLORS.TEXT} />
      </ImageBackground>
    </SafeAreaView>
  );
}
