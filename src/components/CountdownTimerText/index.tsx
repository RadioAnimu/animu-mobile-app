import { Text } from "react-native";

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

  return <Text>{formatTimer(startTime)}</Text>;
}
