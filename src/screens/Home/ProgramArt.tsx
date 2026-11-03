import React from "react";
import { Image } from "expo-image";
import { TouchableOpacity, View } from "react-native";
import { Logo } from "@/components/Logo";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { ART_ASPECT } from "@/screens/Home/metrics";
import { THEME } from "@/theme";

interface Props {
  /** The art's width; its height follows the website's hero proportions. */
  width: number;
  handleClick: () => void;
}

/**
 * The on-air program's art — the website's hero image (the DJ in the NO AR
 * ring beside the program's logo), drawn straight on the background as the
 * website does. It is the picture the program sheet opens with, so a tap
 * opens that sheet. Until the schedule names a program with art, the ANIMU
 * logo holds its place.
 */
export const ProgramArt = React.memo(function ProgramArt({ width, handleClick }: Readonly<Props>) {
  const program = usePlayer().currentProgram;
  const frame = { width, height: width / ART_ASPECT };
  if (!program?.imageUrl) {
    return (
      <View
        style={[frame, { alignItems: "center", justifyContent: "center" }]}
        aria-hidden
      >
        <Logo size={frame.height * 0.6} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={THEME.OPACITY.PRESSED}
      accessibilityRole="button"
      accessibilityLabel={program.name}
      onPress={handleClick}
    >
      <Image
        source={{ uri: program.imageUrl }}
        recyclingKey={program.imageUrl}
        contentFit="contain"
        style={frame}
      />
    </TouchableOpacity>
  );
});
