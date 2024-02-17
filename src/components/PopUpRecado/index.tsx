import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RecadoHaruka from "../../assets/reacdo_haruka.png";
import { THEME } from "../../theme";
import { styles } from "./styles";

interface Props extends ModalProps {
  handleClose: () => void;
  handleOk: () => void;
}

export function PopUpRecado({ handleOk, handleClose, ...rest }: Props) {
  return (
    <Modal animationType="fade" statusBarTranslucent transparent {...rest}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
            <MaterialIcons
              name="close"
              size={20}
              color={THEME.COLORS.WHITE_TEXT}
            />
          </TouchableOpacity>
          <Image source={RecadoHaruka} style={styles.img} />
          <Text style={styles.text}>
            Oii! Sou a Haruka, a DJ da mais moe do Brasil!{"\n"}Vi que já fez a
            sua escolha!{"\n"}Mas antes não quer deixar um recadinho para mim ou
            para nossa equipe? Este recado será entregue no chat principal do
            nosso servidor discord para todo mundo ver{"\n"}💜 Você não precisa
            deixar recado se não quiser.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Deixe seu recado aqui"
            placeholderTextColor="#fff"
          />
          <TouchableOpacity onPress={handleOk} style={styles.okButton}>
            <Text style={styles.okText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
