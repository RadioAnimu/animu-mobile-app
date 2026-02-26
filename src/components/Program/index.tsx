import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { ProgramProps } from "../../api";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { usePlayer } from "../../contexts/player/PlayerProvider";

interface Props {
  handleClick: () => void;
}

export const Program = React.memo(function Program({ handleClick }: Props) {
  const { settings } = useUserSettings();
  const player = usePlayer();

  const program = player.currentProgram;

  if (!program) return null;

  return (
    <TouchableOpacity onPress={handleClick} style={styles.container}>
      <Text style={[styles.title, styles.green]}>{program?.name}</Text>
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
});
