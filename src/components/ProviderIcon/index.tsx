import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons/static";
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import { THEME } from "../../theme";

interface Props {
  provider: string;
  size?: number;
  color?: string;
}

/**
 * Brand mark for an auth provider. MaterialIcons ships the Discord glyph;
 * MaterialCommunityIcons carries Google/Apple and the Animu Connect key.
 */
export function ProviderIcon({
  provider,
  size = THEME.ICON.MD,
  color = THEME.COLORS.TEXT,
}: Props) {
  switch (provider) {
    case "discord":
      return <MaterialIcons name="discord" size={size} color={color} />;
    case "google":
      return <MaterialCommunityIcons name="google" size={size} color={color} />;
    case "apple":
      return <MaterialCommunityIcons name="apple" size={size} color={color} />;
    case "native":
    case "animu":
      return (
        <MaterialCommunityIcons
          name="account-key"
          size={size}
          color={color}
        />
      );
    default:
      return <MaterialIcons name="login" size={size} color={color} />;
  }
}
