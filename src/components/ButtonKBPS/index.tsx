import { Text, TouchableOpacity, View } from "react-native";
import { AnimuInfoProps } from "../../api";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
    selected: boolean;
    category: string;
    kbps: number;
    handleChangeBitrate: () => void;
}

export function ButtonKBPS({ selected, category, kbps, handleChangeBitrate }: Props) {
  return (
    <TouchableOpacity onPress={handleChangeBitrate} style={[styles.container, 
        {
            backgroundColor: !selected ? THEME.COLORS.SHAPE : THEME.COLORS.BITRATEBTNS, 
        }]
    }>
        <Text style={[styles.category, 
        {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.PRIMARY, 
        }]
        }>{category}</Text>
        <Text style={[styles.kbps,
        {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.PRIMARY, 
        }]}>{kbps} kbps</Text>
    </TouchableOpacity>
  );
}
