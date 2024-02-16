import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, ModalProps, TouchableOpacity, View } from "react-native";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props extends ModalProps {
  handleClose: () => void;
}

export function PopUpProgram({ handleClose, ...rest }: Props) {
  return (
    <Modal animationType="fade" statusBarTranslucent transparent {...rest}>
      <View style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
            <MaterialIcons name="close" size={20} color={THEME.COLORS.SHAPE} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
