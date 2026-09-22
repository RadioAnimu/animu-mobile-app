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
/** Fluxer mark — Simple Icons (CC0), used with the company's permission. */
const FLUXER_PATH =
  "M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0M8.79 12.471q-1.092 0-2.078.493-.975.493-1.586 1.575-.395.712-.52 1.726c-.078.626.448 1.135 1.079 1.135.645 0 1.128-.543 1.284-1.17q.133-.531.429-.844.568-.6 1.435-.6.58 0 1.061.289.482.279 1.254.954 1.178 1.038 2.078 1.51.9.46 1.993.461 1.093 0 2.079-.493.985-.492 1.596-1.575.404-.714.522-1.734c.072-.623-.455-1.127-1.083-1.127-.65 0-1.134.549-1.307 1.176a2.1 2.1 0 0 1-.382.774q-.535.665-1.468.665-.579 0-1.05-.279-.46-.29-1.264-.964-1.19-.996-2.09-1.479a4 4 0 0 0-1.982-.493M8.79 6q-1.092 0-2.078.493-.975.492-1.586 1.575-.395.712-.52 1.726c-.078.625.448 1.135 1.079 1.135.645 0 1.128-.543 1.284-1.17q.133-.533.429-.845.568-.6 1.435-.6.58 0 1.061.29.482.278 1.254.953 1.178 1.04 2.078 1.51.9.462 1.993.462t2.079-.493q.985-.493 1.596-1.575.404-.716.522-1.734c.072-.624-.455-1.127-1.083-1.127-.65 0-1.134.549-1.307 1.175a2.1 2.1 0 0 1-.382.775q-.535.664-1.468.664-.579 0-1.05-.278-.46-.29-1.264-.965-1.19-.996-2.09-1.478A4 4 0 0 0 8.79 6";

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
    case "fluxer":
      return <BrandIcon d={FLUXER_PATH} size={size} color={color} />;
    case "native":
    case "animu":
      return <BrandIcon d={ACCOUNT_KEY_PATH} size={size} color={color} />;
    default:
      return <MaterialIcons name="login" size={size} color={color} />;
  }
}
