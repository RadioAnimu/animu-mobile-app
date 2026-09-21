import { ImageBackground } from "expo-image";
import { styles } from "@/components/Background/styles";

import backgroundImg from "@/assets/background-animu.webp";

interface Props {
  children: React.ReactNode;
}

export function Background({ children }: Props) {
  return (
    <ImageBackground source={backgroundImg} style={styles.container}>
      {children}
    </ImageBackground>
  );
}
