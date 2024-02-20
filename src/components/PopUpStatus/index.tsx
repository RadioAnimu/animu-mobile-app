import { MaterialIcons } from "@expo/vector-icons";
import React, { useContext } from "react";
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HarukaError from "../../assets/erro_haruka.png";
import HarukaSuccess from "../../assets/success_haruka.png";
import { ErrorContext } from "../../contexts/error.context";
import { SuccessContext } from "../../contexts/success.context";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props extends ModalProps {}

export function PopUpStatus({ ...rest }: Props) {
  const { successMessage, setSuccessMessage } = useContext(SuccessContext);
  const { errorMessage, setErrorMessage } = useContext(ErrorContext);

  const haruka: ImageSourcePropType =
    successMessage !== "" ? HarukaSuccess : HarukaError;

  const message: string = successMessage !== "" ? successMessage : errorMessage;

  const visible: boolean = successMessage !== "" || errorMessage !== "";

  const handleClose = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  return (
    <Modal
      animationType="fade"
      visible={visible}
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
          <Image source={haruka} style={styles.img} />
          <Text style={styles.text}>{message}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.okButton}>
            <Text style={styles.okText}>Ok</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
