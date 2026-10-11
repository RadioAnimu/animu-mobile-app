import Svg, { Path, Text } from "react-native-svg";
import { THEME } from "@/theme";

interface Props {
  size: number;
  /** The glyph cut into the filled bubble, and its outline (the button's tone). */
  cutout: string;
}

/**
 * Two speech bubbles, "A" and "文" — Apple Music's lyrics translation /
 * pronunciation glyph.
 */
export function PronunciationIcon({ size, cutout }: Readonly<Props>) {
  return (
    <Svg width={size} height={(size * 26) / 30} viewBox="0 0 30 26" fill="none">
      <Path
        d="M5 2H14A3 3 0 0 1 17 5V11A3 3 0 0 1 14 14H8L4.5 17.5V14A3 3 0 0 1 2 11V5A3 3 0 0 1 5 2Z"
        stroke={THEME.COLORS.TEXT}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Text x={9.5} y={11.3} fontSize={9} fontWeight="700" fill={THEME.COLORS.TEXT} textAnchor="middle">
        A
      </Text>
      <Path
        d="M15 10H25A3 3 0 0 1 28 13V19A3 3 0 0 1 25 22V25.5L21.5 22H15A3 3 0 0 1 12 19V13A3 3 0 0 1 15 10Z"
        fill={THEME.COLORS.TEXT}
        stroke={cutout}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Text x={20} y={19.4} fontSize={8.5} fontWeight="700" fill={cutout} textAnchor="middle">
        文
      </Text>
    </Svg>
  );
}
