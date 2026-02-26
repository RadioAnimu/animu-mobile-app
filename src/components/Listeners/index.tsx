import React from "react";
import { Image, Text, View } from "react-native";
import foninho from "../../assets/icons/foninho.png";
import foninho_branco from "../../assets/icons/foninho_branco.png";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

export const Listeners = React.memo(function Listeners() {
  const { settings } = useUserSettings();
  const player = usePlayer();

  const listeners = player.currentListeners;
  const track = player.currentTrack;
  const program = player.currentProgram;

  if (!listeners || !track) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: track.isRequest
            ? THEME.COLORS.REQUEST
            : program?.isLive
              ? THEME.COLORS.LIVE_PROGRAM
              : THEME.COLORS.SHAPE,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color:
              track.isRequest || program?.isLive
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
        ]}
      >
        {listeners.value}
      </Text>
      <Image
        style={styles.foninho}
        source={track.isRequest || program?.isLive ? foninho_branco : foninho}
      />
      <Text
        style={[
          styles.text,
          {
            color:
              track.isRequest || program?.isLive
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.FONT_SIZE.MD + 7.5,
            fontSize: (
              program?.isLive ? program.dj.toUpperCase() : track.isRequest
            )
              ? THEME.FONT_SIZE.MD - 3.8
              : THEME.FONT_SIZE.MD,
            marginLeft: -1.2,
          },
        ]}
      >
        {program?.isLive
          ? program.dj.toUpperCase()
          : track.isRequest
            ? DICT[settings.selectedLanguage].TRACK_REQUEST
            : DICT[settings.selectedLanguage].HARU_CHAN_TEXT}
      </Text>
    </View>
  );
});
