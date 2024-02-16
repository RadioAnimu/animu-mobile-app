import { Text, TouchableOpacity, View } from "react-native";
import { ProgramProps } from "../../api";
import { styles } from "./styles";

interface Props {
  program: ProgramProps;
  handleClick: () => void;
}

export function Program({ program, handleClick }: Props) {
  return (
    <TouchableOpacity onPress={handleClick} style={styles.container}>
      <Text style={[styles.title, styles.green]}>
        {program?.isSaijikkou ? "Animu Sai Jikkou" : program?.programa}
      </Text>
      <Text style={styles.label}>
        COM: <Text style={styles.green}>{program?.locutor}</Text>
      </Text>
    </TouchableOpacity>
  );
}
