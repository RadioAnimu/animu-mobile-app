import { Text } from "react-native";
import { THEME } from "@/theme";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";

interface Props {
  startTime: number;
}

export function CountdownTimerText({ startTime }: Readonly<Props>) {
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
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          {
            fontSize: THEME.FONT_SIZE.BODY,
            fontFamily: THEME.FONT_FAMILY.REGULAR,
            // Proxima Nova's digits are proportional ("1" is half a "0"):
            // tabular figures stop the centered line wobbling every second.
            fontVariant: ["tabular-nums"],
          },
          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.LINE_HEIGHT.BODY,
          },
        ]}
      >
      {formatTimer(startTime)}
    </Text>
  );
}
