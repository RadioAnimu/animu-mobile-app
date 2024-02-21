import { View, Text, Image } from "react-native";
import { styles } from "./styles";
import foninho from "../../assets/icons/foninho.png";
import foninho_branco from "../../assets/icons/foninho_branco.png";
import { AnimuInfoProps } from "../../api";
import { THEME } from "../../theme";
import { DICT } from "../../languages";
import { useContext } from "react";
import { UserSettingsContext } from "../../contexts/user.settings.context";

interface Props {
  info: AnimuInfoProps;
}

export function Listeners({ info }: Props) {
  const { userSettings } = useContext(UserSettingsContext);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: info.track.isRequest
            ? THEME.COLORS.REQUEST
            : info?.program?.isLiveProgram
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
              info.track.isRequest || info?.program?.isLiveProgram
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
        ]}
      >
        {info.listeners}
      </Text>
      <Image
        style={styles.foninho}
        source={
          info.track.isRequest || info?.program?.isLiveProgram
            ? foninho_branco
            : foninho
        }
      />
      <Text
        style={[
          styles.text,
          {
            color:
              info.track.isRequest || info?.program?.isLiveProgram
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
          userSettings.selectedLanguage === "JN" && {
            marginTop: -5.5,
          },
        ]}
      >
        {info?.program?.isLiveProgram
          ? info?.program.locutor.toUpperCase()
          : info.track.isRequest
          ? DICT[userSettings.selectedLanguage].TRACK_REQUEST
          : DICT[userSettings.selectedLanguage].HARU_CHAN_TEXT}
      </Text>
    </View>
  );
}
