import { Image } from "expo-image";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { DICT } from "@/i18n";
import { useDict } from "@/hooks/useDict";
import { styles } from "@/components/PopUpProgram/styles";
import { Sheet } from "@/components/Sheet";

interface Props {
  visible: boolean;
  handleClose: () => void;
}

export const PopUpProgram = React.memo(function PopUpProgram({
  handleClose,
  visible,
}: Props) {
  const dict = useDict();
  const player = usePlayer();

  const _program = player.currentProgram;

  // Try to find localized program data; fall back to domain object fields
  const localized = (() => {
    if (!_program?.raw?.name) {
      return undefined;
    }
    const ptIndex = DICT["PT"].PROGRAMS.findIndex(
      (p) => p.name === _program.raw!.name,
    );
    return ptIndex >= 0
      ? dict.PROGRAMS[ptIndex]
      : undefined;
  })();

  const programName = localized?.name ?? _program?.name;
  const programInfo = localized?.information ?? _program?.info;
  const programTheme = localized?.theme ?? _program?.theme;
  const programDayTime = localized?.dayAndTime;

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="75%">
      {_program ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Image
            source={{ uri: _program.imageUrl }}
            style={styles.img}
            contentFit="contain"
          />

          <Text style={styles.programName}>{programName}</Text>

          <View style={styles.informationBlock}>
            {!!programInfo && (
              <Text style={styles.label}>{programInfo}</Text>
            )}
            {!!programTheme && (
              <Text style={styles.label}>
                {dict.THEME_WORD}: {programTheme}
              </Text>
            )}
            {!!programDayTime && (
              <Text style={styles.label}>{programDayTime}</Text>
            )}
          </View>
        </ScrollView>
      ) : null}
    </Sheet>
  );
});
