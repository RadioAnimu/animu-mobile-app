import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { THEME } from "@/theme";
import { styles } from "@/components/Program/styles";
import { useUserSettings } from "@/contexts/user/UserSettingsProvider";
import { useDict } from "@/hooks/useDict";
import { usePlayer } from "@/contexts/player/PlayerProvider";

interface Props {
  handleClick: () => void;
}

export const Program = React.memo(function Program({ handleClick }: Props) {
  const { settings } = useUserSettings();
  const dict = useDict();
  const player = usePlayer();

  const program = player.currentProgram;

  if (!program) return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={program.name}
      onPress={handleClick}
      style={styles.container}
    >
      <Text style={[styles.title, styles.green]}>{program?.name}</Text>
      <Text
        style={[
          styles.label,

          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
          },
        ]}
      >
        {dict.WITH_DJ}:{" "}
        <Text style={styles.green}>{program?.dj}</Text>
      </Text>
    </TouchableOpacity>
  );
});
