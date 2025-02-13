import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
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
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Clear any existing timeout when alert changes
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const setAlert = useCallback((message: string, type: AlertType) => {
    setAlertState({ message, type });
    // Auto-dismiss after 3 seconds
    timeoutRef.current = setTimeout(() => {
      setAlertState(null);
    }, 3000);
  }, []);

  const clearAlert = useCallback(() => {
    setAlertState(null);
  }, []);

  const success = useCallback(
    (message: string) => {
      setAlert(message, "success");
    },
    [setAlert]
  );

  const error = useCallback(
    (message: string) => {
      setAlert(message, "error");
    },
    [setAlert]
  );

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
          <KeyboardAvoidingView
            behavior="padding"
            style={[styles.container, { zIndex: 9999 }]}
          >
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
