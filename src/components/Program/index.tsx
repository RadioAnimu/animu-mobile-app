import { Text, TouchableOpacity, View } from "react-native";
import { ProgramProps } from "../../api";
import { styles } from "./styles";
import { DICT, selectedLanguage } from "../../languages";
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { useContext } from "react";
import { THEME } from "../../theme";

interface Props {
  program: ProgramProps;
  handleClick: () => void;
}

export function Program({ program, handleClick }: Props) {
  const { userSettings } = useContext(UserSettingsContext);

  return (
    <TouchableOpacity onPress={handleClick} style={styles.container}>
      <Text style={[styles.title, styles.green]}>
        {program?.isSaijikkou ? "Animu Sai Jikkou" : program?.programa}
      </Text>
      <Text
        style={[
          styles.label,

          userSettings.selectedLanguage === "JN" && {
            lineHeight: THEME.FONT_SIZE.PROGRAM_LABELS + 1,
          },
        ]}
      >
        {DICT[userSettings.selectedLanguage].WITH_DJ}:{" "}
        <Text style={styles.green}>{program?.locutor}</Text>
      </Text>
    </TouchableOpacity>
  );
}
