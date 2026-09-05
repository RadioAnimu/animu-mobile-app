import React from "react";
import { Image, Text, View } from "react-native";
import foninho from "../../assets/icons/foninho.png";
import foninho_branco from "../../assets/icons/foninho_branco.png";
import { DICT } from "../../i18n";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer, useStation } from "../../contexts/player/PlayerProvider";

export const Listeners = React.memo(function Listeners() {
  const { settings } = useUserSettings();
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
        style={styles.foninho}
        source={track.isRequest || program?.isLive ? foninho_branco : foninho}
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
            ? DICT[settings.selectedLanguage].TRACK_REQUEST
            : DICT[settings.selectedLanguage].HARU_CHAN_TEXT}
      </Text>
    </View>
  );
});
