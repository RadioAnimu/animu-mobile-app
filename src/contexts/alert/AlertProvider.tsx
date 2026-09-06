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
import { Toast } from "../../components/Toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type AlertType = "success" | "error" | null;

export interface Alert {
  message: string;
  type: AlertType;
}

interface ToastState {
  message: string;
  /** Bumped on every call so re-triggering remounts (fresh fade animation). */
  seed: number;
}

interface AlertContextProps {
  alert: Alert | null;
  setAlert: (message: string, type: AlertType) => void;
  clearAlert: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
  /** Minimalist flash card at the bottom — auto-dismisses, no interaction. */
  toast: (message: string) => void;
}

const AlertContext = createContext<AlertContextProps>({
  alert: null,
  setAlert: () => {},
  clearAlert: () => {},
  success: () => {},
  error: () => {},
  toast: () => {},
});

export const AlertProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [alert, setAlertState] = useState<Alert | null>(null);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const toast = useCallback((message: string) => {
    setToastState((prev) => ({ message, seed: (prev?.seed ?? 0) + 1 }));
  }, []);

  const clearToast = useCallback(() => setToastState(null), []);

  // Render the modal (PopUpStatus) directly within the provider.
  const haruka: ImageSourcePropType =
    alert?.type === "success" ? HarukaSuccess : HarukaError;

  const visible: boolean = alert !== null;

  const handleClose = () => {
    clearAlert();
  };

  const insets = useSafeAreaInsets();

  return (
    <AlertContext.Provider
      value={{ alert, setAlert, clearAlert, success, error, toast }}
    >
      {children}
      <Portal name="toast">
        {toastState && (
          <View
            pointerEvents="none"
            style={[styles.toastWrap, { bottom: insets.bottom + 24 }]}
          >
            <Toast
              key={toastState.seed}
              message={toastState.message}
              onDone={clearToast}
            />
          </View>
        )}
      </Portal>
      <Portal name="alert">
        <Modal
          animationType="fade"
          visible={visible}
          statusBarTranslucent
          transparent
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.container}
          >
            <View style={styles.content}>
              <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                <MaterialIcons
                  name="close"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT}
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
