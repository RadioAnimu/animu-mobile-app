import React from "react";
import { Image, Text, View } from "react-native";
import headphones from "@/assets/icons/headphones.png";
import headphonesWhite from "@/assets/icons/headphones_white.png";
import { THEME } from "@/theme";
import { styles } from "@/components/Listeners/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { usePlayer, useStation } from "@/contexts/player/PlayerProvider";

export const Listeners = React.memo(function Listeners() {
  const { settings } = useUserSettings();
  const dict = useDict();
  const { currentListeners } = useStation();
  const { currentTrack, currentProgram } = usePlayer();

  const track = currentTrack;
  const program = currentProgram;

  if (!currentListeners || !track) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: track.isRequest
            ? THEME.COLORS.FRAME
            : program?.isLive
              ? THEME.COLORS.LIVE
              : THEME.COLORS.BRAND,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color:
              track.isRequest || program?.isLive
                ? THEME.COLORS.TEXT
                : THEME.COLORS.FRAME,
          },
        ]}
      >
        {currentListeners.value}
      </Text>
      <Image
        style={styles.headphones}
        source={track.isRequest || program?.isLive ? headphonesWhite : headphones}
      />
      <Text
        style={[
          styles.text,
          {
            color:
              track.isRequest || program?.isLive
                ? THEME.COLORS.TEXT
                : THEME.COLORS.FRAME,
          },
          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.LINE_HEIGHT.HEADING,
            fontSize: (
              program?.isLive ? program.dj.toUpperCase() : track.isRequest
            )
              ? THEME.FONT_SIZE.HEADING - 3.8
              : THEME.FONT_SIZE.HEADING,
            marginLeft: -1.2,
          },
        ]}
      >
        {program?.isLive
          ? program.dj.toUpperCase()
          : track.isRequest
            ? dict.TRACK_REQUEST
            : dict.HARU_CHAN_TEXT}
      </Text>
    </View>
  );
});
