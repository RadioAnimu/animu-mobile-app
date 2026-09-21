import Svg, { Path } from "react-native-svg";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { THEME } from "@/theme";

interface Props {
  provider: string;
  size?: number;
  color?: string;
}

/**
 * Brand marks for auth providers, inlined as SVG so the app does not have to
 * ship the Material Design Icons font (≈1.3 MB) for three glyphs. Path data
 * comes from Material Design Icons (Apache-2.0).
 */
const GOOGLE_PATH =
  "M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z";
const APPLE_PATH =
  "M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z";
const ACCOUNT_KEY_PATH =
  "M11 10V12H9V14H7V12H5.8C5.4 13.2 4.3 14 3 14C1.3 14 0 12.7 0 11S1.3 8 3 8C4.3 8 5.4 8.8 5.8 10H11M3 10C2.4 10 2 10.4 2 11S2.4 12 3 12 4 11.6 4 11 3.6 10 3 10M16 14C18.7 14 24 15.3 24 18V20H8V18C8 15.3 13.3 14 16 14M16 12C13.8 12 12 10.2 12 8S13.8 4 16 4 20 5.8 20 8 18.2 12 16 12Z";

function BrandIcon({
  d,
  size,
  color,
}: {
  d: string;
  size: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} fill={color} />
    </Svg>
  );
}

export function ProviderIcon({
  provider,
  size = THEME.ICON.MD,
  color = THEME.COLORS.TEXT,
}: Props) {
  switch (provider) {
    case "discord":
      return <MaterialIcons name="discord" size={size} color={color} />;
    case "google":
      return <BrandIcon d={GOOGLE_PATH} size={size} color={color} />;
    case "apple":
      return <BrandIcon d={APPLE_PATH} size={size} color={color} />;
    case "native":
    case "animu":
      return <BrandIcon d={ACCOUNT_KEY_PATH} size={size} color={color} />;
    default:
      return <MaterialIcons name="login" size={size} color={color} />;
  }
}
