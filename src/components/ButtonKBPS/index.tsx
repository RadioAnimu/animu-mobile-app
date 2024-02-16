import { Text, TouchableOpacity, View } from "react-native";
import { AnimuInfoProps } from "../../api";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
  selected: boolean;
  category: string;
  kbps: number;
  handleChangeStream: () => void;
  isSaijikkou: boolean;
}

export function ButtonKBPS({
  selected,
  category,
  kbps,
  handleChangeStream,
  isSaijikkou,
}: Props) {
  return (
    <TouchableOpacity
      onPress={handleChangeStream}
      style={[
        styles.container,
        {
          backgroundColor: !selected
            ? THEME.COLORS.SHAPE
            : THEME.COLORS.BITRATEBTNS,
        },
      ]}
    >
      <Text
        style={[
          styles.category,
          {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.PRIMARY,
          },
        ]}
      >
        {category}
      </Text>
      <Text
        style={[
          styles.kbps,
          {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.PRIMARY,
          },
        ]}
      >
        {kbps} kbps
      </Text>
    </TouchableOpacity>
  );
}
