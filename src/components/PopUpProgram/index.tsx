import { Image } from "expo-image";
import React from "react";
import {
  Modal,
  ModalProps,
  Image as RNImage,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DragIcon from "../../assets/icons/ArrastarParaBaixo.png";
import { usePlayer } from "../../contexts/player/PlayerProvider";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { DICT } from "../../i18n";
import { styles } from "./styles";

interface Props extends ModalProps {
  handleClose: () => void;
}

export const PopUpProgram = React.memo(function PopUpProgram({
  handleClose,
  ...rest
}: Props) {
  const { settings } = useUserSettings();
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
      ? DICT[settings.selectedLanguage].PROGRAMS[ptIndex]
      : undefined;
  })();

  const programName = localized?.name ?? _program?.name;
  const programInfo = localized?.information ?? _program?.info;
  const programTheme = localized?.theme ?? _program?.theme;
  const programDayTime = localized?.dayAndTime;

  return (
    <Modal animationType="slide" statusBarTranslucent transparent {...rest}>
      <View style={styles.container}>
        {/* Backdrop tap-to-close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.content}>
          {/* Drag handle */}
          <TouchableOpacity style={styles.closeArea} onPress={handleClose}>
            <RNImage source={DragIcon} style={styles.dragIcon} />
          </TouchableOpacity>

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
                    {DICT[settings.selectedLanguage].THEME_WORD}: {programTheme}
                  </Text>
                )}
                {!!programDayTime && (
                  <Text style={styles.label}>{programDayTime}</Text>
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});
