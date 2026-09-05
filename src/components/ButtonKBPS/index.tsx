import { Text, TouchableOpacity } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
  selected: boolean;
  category: string;
  kbps: number;
  handleChangeStream: () => void;
}

export function ButtonKBPS({
  selected,
  category,
  kbps,
  handleChangeStream,
}: Props) {
  return (
    <TouchableOpacity
      onPress={handleChangeStream}
      style={[
        styles.container,
        {
          backgroundColor: !selected
            ? THEME.COLORS.BRAND
            : THEME.COLORS.FRAME,
        },
      ]}
    >
      <Text
        style={[
          styles.category,
          {
            color: selected ? THEME.COLORS.TEXT : THEME.COLORS.SURFACE,
          },
        ]}
      >
        {category}
      </Text>
      <Text
        style={[
          styles.kbps,
          {
            color: selected ? THEME.COLORS.TEXT : THEME.COLORS.SURFACE,
          },
        ]}
      >
        {kbps} kbps
      </Text>
    </TouchableOpacity>
  );
}
