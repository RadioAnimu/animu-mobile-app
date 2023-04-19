import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Dimensions, ScrollView } from "react-native";
import TextTicker from "react-native-text-ticker";
import { TrackProps } from "../../api";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
    track: TrackProps;
}

export function Live({ track }: Props) {
  return (
        <View style={styles.track}>
            <TextTicker
              style={styles.title}
              duration={6000}
              loop
              bounce
              repeatSpacer={50}
              marqueeDelay={1000}>
              {track.rawtitle}
            </TextTicker>
            <TextTicker
              style={styles.album}
              duration={6000}
              loop
              bounce
              repeatSpacer={50}
              marqueeDelay={1000}>
              {track.album}
            </TextTicker>
            <TextTicker
              style={styles.artist}
              duration={6000}
              loop
              bounce
              repeatSpacer={50}
              marqueeDelay={1000}>
              {track.artist}
            </TextTicker>
        </View>
  );
}
