import { View, useWindowDimensions, Platform } from "react-native";
import TextTicker from "react-native-text-ticker";
import { IMGS } from "../../languages";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { Track } from "../../core/domain/track";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import React from "react";

interface Props {
  track: Track;
}

// Base scroll speed in characters per second
const BASE_SCROLL_SPEED = 15; // Adjust this value to match desired reading speed

export function Live({ track }: Props) {
  const { settings } = useUserSettings();
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const NoAr = IMGS[settings.selectedLanguage].LIVE_LABEL;

  // State for individual durations
  const [durations, setDurations] = useState({
    anime: 0,
    artist: 0,
    song: 0,
  });

  const calculateScrollDuration = useCallback(
    async (text: string) => {
      if (!text || containerWidth === 0) return 0;

      try {
        // Measure text width
        const { width: textWidth } = await measure({
          text,
          width: windowWidth, // Maximum width for measurement
          fontFamily: styles.title.fontFamily, // Match your text style
          fontSize: styles.title.fontSize,
        });

        // Calculate needed duration based on text length and container width
        const screenCount = Math.ceil(textWidth / containerWidth);
        const baseDuration = (text.length / BASE_SCROLL_SPEED) * 1000;

        // Adjust duration based on how many "screens" the text spans
        return Math.min(
          Math.max(
            baseDuration * screenCount,
            3000 // Minimum duration
          ),
          15000
        ); // Maximum duration
      } catch (error) {
        console.error("Error measuring text:", error);
        return 6000; // Fallback duration
      }
    },
    [containerWidth, windowWidth]
  );

  useEffect(() => {
    const updateDurations = async () => {
      const animeDuration = await calculateScrollDuration(track.anime);
      const artistDuration = await calculateScrollDuration(track.artist);
      const songDuration = await calculateScrollDuration(track.title);

      setDurations({
        anime: animeDuration,
        artist: artistDuration,
        song: songDuration,
      });
    };

    updateDurations();
  }, [track, calculateScrollDuration]);

  return (
    <View
      style={styles.track}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - 40)} // Adjust padding
    >
      <NoAr />
      <View style={styles.info}>
        <TextTicker
          style={styles.title}
          duration={durations.anime}
          loop={durations.anime > 0}
          repeatSpacer={20}
          bounce={false}
          marqueeDelay={2500}
          shouldAnimateTreshold={1}
          isInteraction={false}
        >
          {track.anime}
        </TextTicker>

        <TextTicker
          style={styles.artist}
          duration={durations.artist}
          loop={durations.artist > 0}
          bounce={false}
          repeatSpacer={20}
          marqueeDelay={2500}
          shouldAnimateTreshold={1}
          isInteraction={false}
        >
          {track.artist}
        </TextTicker>

        <TextTicker
          style={styles.song}
          duration={durations.song}
          loop={durations.song > 0}
          bounce={false}
          repeatSpacer={20}
          marqueeDelay={2500}
          shouldAnimateTreshold={1}
          isInteraction={false}
        >
          {track.title}
        </TextTicker>
      </View>
    </View>
  );
}
function measure({
  text,
  width: maxWidth,
  fontFamily,
  fontSize,
}: {
  text: string;
  width: number;
  fontFamily: string;
  fontSize: number;
}): Promise<{ width: number }> {
  // Use fallback estimation for all platforms since setNativeProps is not available
  return Promise.resolve({ width: text.length * (fontSize * 0.6) });
}
