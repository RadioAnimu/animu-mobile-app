import React, { createContext, useContext, useState, ReactNode } from "react";
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
import { MaterialIcons } from "@expo/vector-icons";
import HarukaError from "../../assets/erro_haruka.png";
import HarukaSuccess from "../../assets/success_haruka.png";
import { THEME } from "../../theme";
import { styles } from "./styles";
import { Portal } from "../Portal";

export type AlertType = "success" | "error" | null;

export interface Alert {
  message: string;
  type: AlertType;
}

interface AlertContextProps {
  alert: Alert | null;
  setAlert: (message: string, type: AlertType) => void;
  clearAlert: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const AlertContext = createContext<AlertContextProps>({
  alert: null,
  setAlert: () => {},
  clearAlert: () => {},
  success: () => {},
  error: () => {},
});

export const AlertProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [alert, setAlertState] = useState<Alert | null>(null);

  const setAlert = (message: string, type: AlertType) => {
    setAlertState({ message, type });
  };

  const clearAlert = () => {
    setAlertState(null);
  };

  const success = (message: string) => {
    if (!alert || alert.message !== message) {
      setAlert(message, "success");
    }
  };

  const error = (message: string) => {
    if (!alert || alert.message !== message) {
      setAlert(message, "error");
    }
  };

  // Render the modal (PopUpStatus) directly within the provider.
  const haruka: ImageSourcePropType =
    alert?.type === "success" ? HarukaSuccess : HarukaError;

  const visible: boolean = alert !== null;

  const handleClose = () => {
    clearAlert();
  };

  return (
    <AlertContext.Provider
      value={{ alert, setAlert, clearAlert, success, error }}
    >
      {children}
      <Portal name="alert">
        <Modal
          animationType="fade"
          visible={visible}
          statusBarTranslucent
          transparent
        >
          <KeyboardAvoidingView behavior="padding" style={styles.container}>
            <View style={styles.content}>
              <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                <MaterialIcons
                  name="close"
                  size={20}
                  color={THEME.COLORS.WHITE_TEXT}
                />
              </TouchableOpacity>
              <Image source={haruka} style={styles.img} />
              <Text style={styles.text}>{alert?.message}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.okButton}>
                <Text style={styles.okText}>Ok</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);
