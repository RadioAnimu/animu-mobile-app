import Svg, { Path, Rect, SvgProps } from "react-native-svg";
import { THEME } from "../../theme";

/** Header back chevron shared by the full-screen settings-style pages. */
export const BackArrow = (props: SvgProps) => (
  <Svg width="21" height="19" viewBox="0 0 21 19" fill="none" {...props}>
    <Rect x="6" y="6" width="15" height="7" rx="2" fill={THEME.COLORS.TEXT} />
    <Path
      d="M-4.15258e-07 9.5L11.25 17.7272L11.25 1.27276L-4.15258e-07 9.5Z"
      fill={THEME.COLORS.TEXT}
    />
  </Svg>
);
