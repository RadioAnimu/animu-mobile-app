import { Image } from "expo-image";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { usePlayer } from "@/contexts/player/PlayerProvider";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useDict } from "@/hooks/useDict";
import { IMG_HEIGHT, styles } from "@/components/PopUpProgram/styles";
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
  // Short windows (landscape phones) cannot hold the full artwork band.
  const layout = useResponsiveLayout();

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

  // In a short window the artwork gives way to the text: it shrinks to a
  // third of the window height so the name and info block fit under it (the
  // sheet itself is height-capped there and its content scrolls). Portrait
  // keeps the full band untouched.
  const imgStyle = layout.short
    ? [
        styles.img,
        { height: Math.min(IMG_HEIGHT, Math.round(layout.height * 0.3)) },
      ]
    : styles.img;

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="75%">
      {program ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Image
            source={{ uri: program.imageUrl }}
            style={imgStyle}
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
