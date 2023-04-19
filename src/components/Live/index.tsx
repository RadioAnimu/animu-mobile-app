import { View, Image } from "react-native";
import TextTicker from "react-native-text-ticker";
import { TrackProps } from "../../api";
import { styles } from "./styles";

interface Props {
    track: TrackProps;
}

import Svg, { SvgProps, Path } from "react-native-svg"
const NoAr = (props: SvgProps) => (
  <Svg
    width={41}
    height={92}
    fill="none"
    {...props}
  >
    <Path fill="red" d="M0 0h41v92H0z" />
    <Path
      fill="#fff"
      d="M30 68.425v3.425L19.125 79.8H30v3.55H13.325V79.7L23.8 71.975H13.325v-3.55H30Zm.3-11.188c0 2.517-.808 4.6-2.425 6.25-1.633 1.633-3.7 2.45-6.2 2.45s-4.558-.817-6.175-2.45c-1.633-1.65-2.45-3.733-2.45-6.25 0-2.533.808-4.617 2.425-6.25 1.617-1.65 3.683-2.475 6.2-2.475 2.517 0 4.583.825 6.2 2.475 1.617 1.633 2.425 3.717 2.425 6.25Zm-4.7 3.675c1.033-.933 1.55-2.158 1.55-3.675s-.517-2.742-1.55-3.675c-1.033-.933-2.342-1.4-3.925-1.4-1.583 0-2.892.467-3.925 1.4-1.033.933-1.55 2.158-1.55 3.675s.517 2.742 1.55 3.675c1.033.917 2.342 1.375 3.925 1.375 1.583 0 2.892-.458 3.925-1.375ZM30 24.074v4.05l-2.825 1.025v7.15L30 37.35v4.05l-16.675-6.45V30.5L30 24.074Zm-5.95 6.05-7.175 2.6 7.175 2.6v-5.2ZM30 9.034v4.076l-5.925 3.275v2.6H30v3.55H13.325v-7.8c0-1.717.5-3.075 1.5-4.075 1-1.017 2.292-1.525 3.875-1.525 1.367 0 2.475.358 3.325 1.075.85.7 1.392 1.558 1.625 2.575L30 9.035Zm-9.05 6.226c0-.734-.2-1.334-.6-1.8-.417-.467-.967-.7-1.65-.7-.683 0-1.225.233-1.625.7-.417.466-.625 1.066-.625 1.8v3.725h4.5V15.26Z"
    />
  </Svg>
)

export function Live({ track }: Props) {
  return (
        <View style={styles.track}>
            <NoAr />
            <View style={styles.info}>
                <TextTicker
                  style={styles.title}
                  duration={6000}
                  loop
                  bounce
                  repeatSpacer={50}
                  marqueeDelay={1000}>
                  {track.anime}
                </TextTicker>
                <TextTicker
                  style={styles.artist}
                  duration={6000}
                  loop
                  bounce
                  repeatSpacer={50}
                  marqueeDelay={1000}>
                  {track.artist}
                </TextTicker>
                <TextTicker
                  style={styles.song}
                  duration={6000}
                  loop
                  bounce
                  repeatSpacer={50}
                  marqueeDelay={1000}>
                  {track.song}
                </TextTicker>
            </View>
        </View>
  );
}
