import { Text, TouchableOpacity } from "react-native";
import { ProgramProps } from "../../api";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { Program as ProgramType } from "../../core/domain/program";

interface Props {
  program: ProgramType;
  handleClick: () => void;
}

export function Program({ program, handleClick }: Props) {
  const { settings } = useUserSettings();

  return (
    <TouchableOpacity onPress={handleClick} style={styles.container}>
      <Text style={[styles.title, styles.green]}>
        {program?.isSaijikkou ? "Animu Sai Jikkou" : program?.name}
      </Text>
      <Text
        style={[
          styles.label,

          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.FONT_SIZE.PROGRAM_LABELS + 1,
          },
        ]}
      >
        {DICT[settings.selectedLanguage].WITH_DJ}:{" "}
        <Text style={styles.green}>{program?.dj}</Text>
      </Text>
    </TouchableOpacity>
  );
}
