import { useContext } from "react";
import { Text, TouchableOpacity } from "react-native";
import { ProgramProps } from "../../api";
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";

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
