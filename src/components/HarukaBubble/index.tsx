import { Image } from "expo-image";
import { Text, View } from "react-native";

import HarukaFace from "@/assets/success_haruka.webp";
import { ChatBubble } from "@/components/ChatBubble";
import { styles } from "@/components/HarukaBubble/styles";
import { THEME } from "@/theme";

interface Props {
  text: string;
}

/** Haruka's face (cropped from her success art) saying `text` in a bubble. */
export function HarukaBubble({ text }: Readonly<Props>) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Image
          accessible={false}
          contentFit="cover"
          source={HarukaFace}
          style={styles.face}
        />
      </View>
      <ChatBubble side="left" color={THEME.COLORS.FRAME} style={styles.bubble}>
        <Text style={styles.text}>{text}</Text>
      </ChatBubble>
    </View>
  );
}
