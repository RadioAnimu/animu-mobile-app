import { Text } from "react-native";
import { styles } from "./styles";

interface Props {
startTime: number;
}

export function CountdownTimerText({ startTime }: Props) {
    console.log(startTime);

    const fomartTime = (timeStamp: number): string => {
        timeStamp = Math.floor(timeStamp / 1000);
        let minutes: number = Math.floor(timeStamp / 60);
        let seconds: number = Math.floor(timeStamp % 60);
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    };


    return (
            <Text>{fomartTime(startTime)}</Text>
           );
}
