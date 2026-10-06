import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { styles } from "@/components/ChatBubble/styles";

interface Props {
  /** Which side the speaker is on — the tail points that way. */
  side: "left" | "right";
  color: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A message bubble with a chat-style tail toward its speaker. */
export function ChatBubble({ side, color, children, style }: Readonly<Props>) {
  const left = side === "left";

  return (
    <View style={[styles.bubble, { backgroundColor: color }, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.tail,
          left ? styles.tailLeft : styles.tailRight,
          left ? { borderRightColor: color } : { borderLeftColor: color },
        ]}
      />
      {children}
    </View>
  );
}
