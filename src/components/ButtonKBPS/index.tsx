import { Text, TouchableOpacity, View } from "react-native";
import { AnimuInfoProps } from "../../api";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props {
    selected: boolean;
    category: string;
    kbps: number;
}

export function ButtonKBPS({ selected, category, kbps }: Props) {
  return (
    <TouchableOpacity style={[styles.container, 
        {
            backgroundColor: selected ? THEME.COLORS.SHAPE : THEME.COLORS.PRIMARY, 
        }]
    }>
        <Text style={[styles.category, 
        {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.SHAPE, 
        }]
        }>{category}</Text>
        <Text style={[styles.kbps,
        {
            color: selected ? THEME.COLORS.WHITE_TEXT : THEME.COLORS.SHAPE, 
        }]}>{kbps} kbps</Text>
    </TouchableOpacity>
  );
}
