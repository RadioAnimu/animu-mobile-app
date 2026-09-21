import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Image } from "expo-image";
import { THEME } from "@/theme";
import { hideSplashOnce } from "@/screens/Loading/splash";
import { FALLBACK_HIDE_MS, styles } from "@/screens/Loading/styles";
import splashScreenImage from "@app/assets/splash_top.webp";

export function Loading() {
  useEffect(() => {
    const timeout = setTimeout(hideSplashOnce, FALLBACK_HIDE_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={splashScreenImage}
        style={styles.image}
        contentFit="contain"
        onLoad={hideSplashOnce}
      />
      <View style={styles.spinner}>
        <ActivityIndicator color={THEME.COLORS.TEXT} />
      </View>
    </View>
  );
}
