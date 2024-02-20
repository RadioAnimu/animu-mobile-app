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
import HarukaErro from "../../assets/erro_haruka.png";
import { ErrorContext } from "../../contexts/error.context";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props extends ModalProps {}

export function PopUpErro({ ...rest }: Props) {
  const { errorMessage, setErrorMessage } = useContext(ErrorContext);

  const close = () => {
    setErrorMessage("");
  };

  return (
    <Modal
      animationType="fade"
      visible={errorMessage !== ""}
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
          <Image source={HarukaErro} style={styles.img} />
          <Text style={styles.text}>{errorMessage}</Text>
          <TouchableOpacity onPress={close} style={styles.okButton}>
            <Text style={styles.okText}>Ok</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
