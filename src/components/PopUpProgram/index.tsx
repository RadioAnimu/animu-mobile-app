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

interface Props extends ModalProps {
  handleClose: () => void;
  program: ProgramProps;
}

export function PopUpProgram({ program, handleClose, ...rest }: Props) {
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
          <Image source={{ uri: program.imagem }} style={styles.img} />
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
              {program.programa}
            </Text>
            {program.raw && (
              <>
                <Text style={styles.label}>{program.raw?.theme}</Text>
                <Text style={styles.label}>{program.raw?.dayAndTime}</Text>
              </>
            )}
            <Text
              style={[
                styles.label,
                {
                  fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
                },
              ]}
            >
              {program.infoPrograma}
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
              Tema: {program.temaPrograma}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
