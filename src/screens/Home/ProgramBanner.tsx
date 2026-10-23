import React from "react";
import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { BANNER_ASPECT } from "@/screens/Home/metrics";
import { THEME } from "@/theme";
import { CONTINUOUS } from "@/theme/shape";

interface Props {
  /** Banner width; the height follows the website's hero proportions. */
  width: number;
  handleClick: () => void;
}

/**
 * The on-air program's banner — the website's hero image. It is the same
 * picture the program sheet opens with, so a tap opens that sheet. Until the
 * schedule names a program with an image an empty block of the same size holds
 * the room, so the program line below doesn't jump when it arrives.
 */
export const ProgramBanner = React.memo(function ProgramBanner({
  width,
  handleClick,
}: Readonly<Props>) {
  const program = usePlayer().currentProgram;
  const frame = { width, height: width / BANNER_ASPECT };
  if (!program?.imageUrl) {
    return (
      <View
        style={frame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
        contentFit="cover"
        style={[styles.image, frame]}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  image: {
    backgroundColor: THEME.COLORS.APP_BG,
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    overflow: "hidden",
  },
});
