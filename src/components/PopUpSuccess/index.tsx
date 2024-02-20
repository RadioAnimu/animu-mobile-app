import { MaterialIcons } from "@expo/vector-icons";
import React, { useContext } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HarukaSuccess from "../../assets/success_haruka.png";
import { SuccessContext } from "../../contexts/success.context";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props extends ModalProps {}

export function PopUpSuccess({ ...rest }: Props) {
  const { successMessage, setSuccessMessage } = useContext(SuccessContext);

  const close = () => {
    setSuccessMessage("");
  };

  return (
    <Modal
      animationType="fade"
      visible={successMessage !== ""}
      statusBarTranslucent
      transparent
      {...rest}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={close} style={styles.closeIcon}>
            <MaterialIcons
              name="close"
              size={20}
              color={THEME.COLORS.WHITE_TEXT}
            />
          </TouchableOpacity>
          <Image source={HarukaSuccess} style={styles.img} />
          <Text style={styles.text}>{successMessage}</Text>
          <TouchableOpacity onPress={close} style={styles.okButton}>
            <Text style={styles.okText}>Ok</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
