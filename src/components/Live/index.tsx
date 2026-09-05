import React, { useCallback, useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import TextTicker from "react-native-text-ticker";
import { IMGS } from "../../i18n";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

// Base scroll speed in characters per second
const BASE_SCROLL_SPEED = 15; // Adjust this value to match desired reading speed
const MIN_SCROLL_DURATION = 3000;
const MAX_SCROLL_DURATION = 15000;
const FALLBACK_DURATION = 6000;
const REPEAT_SPACER = 20;
const MARQUEE_DELAY = 2500;
const CONTAINER_WIDTH_PADDING = 40;

export const Live = React.memo(function Live() {
  const { settings } = useUserSettings();
  const player = usePlayer();
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const NoAr = IMGS[settings.selectedLanguage].LIVE_LABEL;

  const track = player.currentTrack;

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
            MIN_SCROLL_DURATION,
          ),
          MAX_SCROLL_DURATION,
        ); // Maximum duration
      } catch (error) {
        console.error("Error measuring text:", error);
        return FALLBACK_DURATION;
      }
    },
    [containerWidth, windowWidth],
  );

  useEffect(() => {
    if (!track) return;

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

  if (!track) return null;

  return (
    <View
      style={styles.track}
      onLayout={(e) =>
        setContainerWidth(e.nativeEvent.layout.width - CONTAINER_WIDTH_PADDING)
      }
    >
      <NoAr />
      <View style={styles.info}>
        <TextTicker
          style={styles.title}
          duration={durations.anime}
          loop={durations.anime > 0}
          repeatSpacer={REPEAT_SPACER}
          bounce={false}
          marqueeDelay={MARQUEE_DELAY}
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
          repeatSpacer={REPEAT_SPACER}
          marqueeDelay={MARQUEE_DELAY}
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
          repeatSpacer={REPEAT_SPACER}
          marqueeDelay={MARQUEE_DELAY}
          shouldAnimateTreshold={1}
          isInteraction={false}
        >
          {track.title}
        </TextTicker>
      </View>
    </View>
  );
});
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
