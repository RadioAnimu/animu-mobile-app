import { Image } from "expo-image";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useDict } from "@/hooks/useDict";
import { DICT, type Dict } from "@/i18n";
import { styles } from "@/components/PopUpProgram/styles";
import { Sheet } from "@/components/Sheet";

/**
 * The localized PROGRAMS entry for the station's program: the per-language
 * tables are index-aligned, and the station names programs in Portuguese.
 */
const localizedProgram = (dict: Dict, name: string | undefined) => {
  const key = name?.trim().toLowerCase();
  if (!key) return undefined;
  const index = DICT.PT.PROGRAMS.findIndex((entry) => entry.name.trim().toLowerCase() === key);
  return index < 0 ? undefined : dict.PROGRAMS[index];
};

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
  // In landscape the program's art is already on screen — the Home hero —
  // so the sheet is its text alone.
  const { landscape } = useResponsiveLayout();

  const program = player.currentProgram;

  // Localized program data, falling back to the station's own fields.
  const localized = localizedProgram(dict, program?.name);

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
          {landscape ? null : (
            <Image
              source={{ uri: program.imageUrl }}
              style={styles.img}
              contentFit="contain"
            />
          )}

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
