import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { DICT, selectedLanguage } from "../../languages";

interface Props extends ModalProps {
  handleClose: () => void;
  handleOk: () => Promise<void>;
  handleChangeText: (text: string) => void;
}

type Status = "idle" | "requesting";

export function PopUpRecado({
  handleOk,
  handleClose,
  handleChangeText,
  ...rest
}: Props) {
  const [status, setStatus] = useState<Status>("idle");

  const _handleOk = async () => {
    setStatus("requesting");
    await handleOk();
    setStatus("idle");
  };

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
          <Text style={styles.text}>{DICT[selectedLanguage].INFO_REQUEST}</Text>
          <TextInput
            style={[
              styles.input,
              status === "requesting" && styles.inputDisabled,
            ]}
            placeholder={DICT[selectedLanguage].SEND_REQUEST_PLACEHOLDER}
            placeholderTextColor="#fff"
            onChange={(e) => handleChangeText(e.nativeEvent.text)}
            editable={status === "idle"}
            onSubmitEditing={_handleOk}
          />
          {status === "requesting" ? (
            <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
          ) : (
            <TouchableOpacity onPress={_handleOk} style={styles.okButton}>
              <Text style={styles.okText}>
                {DICT[selectedLanguage].SEND_REQUEST_BUTTON_TEXT}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
