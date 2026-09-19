import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useCallback,
  useEffect,
  useMemo,
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
import MaterialIcons from "@react-native-vector-icons/material-icons/static";
import HarukaError from "@/assets/error_haruka.png";
import HarukaSuccess from "@/assets/success_haruka.png";
import { THEME } from "@/theme";
import { styles } from "@/contexts/alert/styles";
import { Portal } from "@/contexts/Portal";
import { Toast } from "@/components/Toast";
import { useDict } from "@/hooks/useDict";
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
    // Auto-dismiss after 3 seconds. Clear the previous timer first — a
    // second alert arriving within the window must not be dismissed by
    // the first alert's pending timeout.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setAlertState(null);
    }, 3000);
  }, []);

  const clearAlert = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
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
  const dict = useDict();

  const value = useMemo(
    () => ({ alert, setAlert, clearAlert, success, error, toast }),
    [alert, setAlert, clearAlert, success, error, toast],
  );

  return (
    <AlertContext.Provider value={value}>
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
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={dict.A11Y_CLOSE}
                onPress={handleClose}
                style={styles.closeIcon}
              >
                <MaterialIcons
                  name="close"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT}
                />
              </TouchableOpacity>
              <Image source={haruka} style={styles.img} />
              <Text style={styles.text}>{alert?.message}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleClose}
                style={styles.okButton}
              >
                <Text style={styles.okText}>{dict.OK_BUTTON}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);
