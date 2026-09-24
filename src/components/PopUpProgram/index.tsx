import { Image } from "expo-image";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
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

  const program = player.currentProgram;

  // Resolve the localized program data via the index-aligned PROGRAMS
  // tables; fall back to domain object fields
  const localized = (() => {
    if (program?.programIndex == null || program.programIndex < 0) {
      return undefined;
    }
    return dict.PROGRAMS[program.programIndex];
  })();

  const programName = localized?.name ?? program?.name;
  const programInfo = localized?.information ?? program?.info;
  const programTheme = localized?.theme ?? program?.theme;
  const programDayTime = localized?.dayAndTime;

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="75%">
      {program ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Image
            source={{ uri: program.imageUrl }}
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
