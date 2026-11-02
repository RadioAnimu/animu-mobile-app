import { StyleSheet } from "react-native";
import { Image } from "expo-image";

export interface BlurredCoverProps {
  cover: string;
  blurRadius: number;
  /** Cross-fade from the previous cover (ms). */
  transition: number;
}

/** The cover filling its parent, blurred once by the image view. */
export function BlurredCover({ cover, blurRadius, transition }: Readonly<BlurredCoverProps>) {
  return (
    <Image
      source={cover}
      style={StyleSheet.absoluteFill}
      blurRadius={blurRadius}
      contentFit="cover"
      transition={transition}
    />
  );
}
