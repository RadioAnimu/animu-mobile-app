import React, { useContext, useState } from "react";
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
import { UserSettingsContext } from "../../contexts/user.settings.context";
import { DICT } from "../../languages";
import { THEME } from "../../theme";
import { styles } from "./styles";
import CloseIcon from "../../assets/icons/ArrastarParaBaixo.png";

interface Props extends ModalProps {
  handleClose: () => void;
  handleOk: () => Promise<void>;
}

type Status = "idle" | "requesting";

export function LiveRequestModal({ handleOk, handleClose, ...rest }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  const _handleOk = async () => {
    setStatus("requesting");
    await handleOk();
    setStatus("idle");
  };

  const { userSettings } = useContext(UserSettingsContext);

  return (
    <Modal animationType="slide" statusBarTranslucent transparent {...rest}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.closeArea} onPress={handleClose}>
            <Image style={styles.closeAreaIcon} source={CloseIcon} />
          </TouchableOpacity>
          <Text style={styles.text}>
            {DICT[userSettings.selectedLanguage].INFO_REQUEST}
          </Text>
          <TextInput
            style={[
              styles.input,
              status === "requesting" && styles.inputDisabled,
            ]}
            placeholder={
              DICT[userSettings.selectedLanguage].SEND_REQUEST_PLACEHOLDER
            }
            placeholderTextColor="#fff"
            editable={status === "idle"}
            onSubmitEditing={_handleOk}
          />
          {status === "requesting" ? (
            <ActivityIndicator color={THEME.COLORS.WHITE_TEXT} />
          ) : (
            <TouchableOpacity onPress={_handleOk} style={styles.okButton}>
              <Text style={styles.okText}>
                {DICT[userSettings.selectedLanguage].SEND_REQUEST_BUTTON_TEXT}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
