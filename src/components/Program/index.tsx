import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
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

  // Two invisible lines (a real glyph, so they measure like text) hold the
  // block until the schedule lands, so the stream picker below doesn't jump
  // up and back.
  if (!program) {
    return (
      <View
        style={[styles.container, styles.placeholder]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME} style={styles.title}>
          –
        </Text>
        <Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          style={[
            styles.label,
            settings.selectedLanguage === "JN" && {
              lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
            },
          ]}
        >
          –
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={THEME.OPACITY.PRESSED}
      accessibilityRole="button"
      // The visible content includes the DJ line; the overriding label must
      // carry it too or VoiceOver/TalkBack silently drops it.
      accessibilityLabel={`${program.name}. ${dict.WITH_DJ}: ${program.dj}`}
      onPress={handleClick}
      style={styles.container}
    >
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[styles.title, styles.green]}
      >
        {program?.name}
      </Text>
      <Text
        maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
        style={[
          styles.label,

          settings.selectedLanguage === "JN" && {
            lineHeight: THEME.LINE_HEIGHT.SUBHEAD,
          },
        ]}
      >
        {dict.WITH_DJ}:{" "}
        <Text
          maxFontSizeMultiplier={THEME.FONT_SCALE.CHROME}
          style={styles.green}
        >
          {program?.dj}
        </Text>
      </Text>
    </TouchableOpacity>
  );
});
