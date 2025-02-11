import { Image, Text, View } from "react-native";
import foninho from "../../assets/icons/foninho.png";
import foninho_branco from "../../assets/icons/foninho_branco.png";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { Listeners as ListenerType } from "../../core/domain/listeners";
import { Track } from "../../core/domain/track";
import { Program } from "../../core/domain/program";

interface Props {
  listeners: ListenerType;
  track: Track;
  program?: Program;
}

export function Listeners({ props }: { props: Props }) {
  const { settings } = useUserSettings();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: props.track.isRequest
            ? THEME.COLORS.REQUEST
            : props.program?.isLive
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
              props.track.isRequest || props?.program?.isLive
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
        ]}
      >
        {props.listeners.value}
      </Text>
      <Image
        style={styles.foninho}
        source={
          props.track.isRequest || props?.program?.isLive
            ? foninho_branco
            : foninho
        }
      />
      <Text
        style={[
          styles.text,
          {
            color:
              props.track.isRequest || props?.program?.isLive
                ? THEME.COLORS.WHITE_TEXT
                : THEME.COLORS.LISTENERS,
          },
          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.FONT_SIZE.MD + 7.5,
            fontSize: (
              props?.program?.isLive
                ? props?.program.dj.toUpperCase()
                : props.track.isRequest
            )
              ? THEME.FONT_SIZE.MD - 3.8
              : THEME.FONT_SIZE.MD,
            marginLeft: -1.2,
          },
        ]}
      >
        {props?.program?.isLive
          ? props?.program.dj.toUpperCase()
          : props.track.isRequest
          ? DICT[settings.selectedLanguage].TRACK_REQUEST
          : DICT[settings.selectedLanguage].HARU_CHAN_TEXT}
      </Text>
    </View>
  );
}
