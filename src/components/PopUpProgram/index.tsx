import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Modal,
  ModalProps,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ProgramProps } from "../../api";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { useUserSettings } from "../../contexts/user/UserSettingsProvider";
import { Program } from "../../core/domain/program";

interface Props extends ModalProps {
  handleClose: () => void;
  _program: Program;
}

export function PopUpProgram({ _program, handleClose, ...rest }: Props) {
  const { settings } = useUserSettings();

  let i = 0;
  let program: ProgramProps["raw"] = DICT["PT"].PROGRAMS.find((item) => {
    if (item.name === _program?.raw?.name) {
      return item;
    } else {
      i++;
    }
  });

  program = DICT[settings.selectedLanguage].PROGRAMS[i];

  if (!program) {
    return null;
  }

  return (
    <Modal animationType="fade" statusBarTranslucent transparent {...rest}>
      <View style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
            <MaterialIcons
              name="close"
              size={20}
              color={THEME.COLORS.WHITE_TEXT}
            />
          </TouchableOpacity>
          <Image source={{ uri: _program.imageUrl }} style={styles.img} />
          <View style={styles.informationBlock}>
            <Text
              style={[
                styles.label,
                {
                  textAlign: "center",
                  color: THEME.COLORS.SHAPE,
                },
              ]}
            >
              {program.name}
            </Text>
            <Text
              style={[
                styles.label,
                {
                  fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
                },
              ]}
            >
              {program.information}
            </Text>
            <Text
              style={[
                styles.label,
                {
                  textAlign: "left",
                  fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
                },
              ]}
            >
              {DICT[settings.selectedLanguage].THEME_WORD}: {program.theme}
            </Text>
            <Text
              style={[
                styles.label,
                {
                  textAlign: "left",
                  fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
                },
              ]}
            >
              {program.dayAndTime}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
