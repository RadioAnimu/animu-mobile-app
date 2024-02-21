import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Modal,
  ModalProps,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { ProgramProps } from "../../api";
import { DICT, selectedLanguage } from "../../languages";

interface Props extends ModalProps {
  handleClose: () => void;
  _program: ProgramProps;
}

export function PopUpProgram({ _program, handleClose, ...rest }: Props) {
  const program: ProgramProps["raw"] = DICT[selectedLanguage].PROGRAMS.find(
    (item) => item.name === _program.raw?.name
  );

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
          <Image source={{ uri: program.img }} style={styles.img} />
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
              Tema: {program.theme}
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
