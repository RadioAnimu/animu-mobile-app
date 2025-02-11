import { Text } from "react-native";
import { THEME } from "../../theme";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";

interface Props {
  startTime: number;
}

export function CountdownTimerText({ startTime }: Props) {
  const formatTimer = (timeStamp: number): string => {
    if (timeStamp <= 0) {
      timeStamp = 0;
    }
    timeStamp = Math.floor(timeStamp / 1000);
    let minutes: number = Math.floor(timeStamp / 60);
    let seconds: number = Math.floor(timeStamp % 60);
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  };

  const { settings } = useUserSettings();

  return (
    <Text
      style={[
        {
          fontSize: THEME.FONT_SIZE.SM,
          fontFamily: THEME.FONT_FAMILY.REGULAR,
        },
        settings.selectedLanguage === "JN" && {
          lineHeight: THEME.FONT_SIZE.SM + 2,
        },
      ]}
    >
      {formatTimer(startTime)}
    </Text>
  );
}
