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
import { Image, type ImageSource } from "expo-image";
import {
  KeyboardAvoidingView,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "@/components/Icon";
import HarukaError from "@/assets/error_haruka.webp";
import HarukaSuccess from "@/assets/success_haruka.webp";
import { THEME } from "@/theme";
import { styles } from "@/contexts/alert/styles";
import { Portal } from "@/contexts/Portal";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Toast, type ToastVariant } from "@/components/Toast";
import { useDict } from "@/hooks/useDict";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AlertType = "success" | "error" | null;

interface Alert {
  message: string;
  type: AlertType;
}

interface ToastState {
  message: string;
  variant: ToastVariant;
  /** Bumped on every call so re-triggering remounts (fresh fade animation). */
  seed: number;
}

interface AlertContextProps {
  success: (message: string) => void;
  error: (message: string) => void;
  /**
   * Minimalist flash chip at the bottom — auto-dismisses, no interaction.
   * Errors stay on screen longer than successes.
   */
  toast: (message: string, variant?: ToastVariant) => void;
}

const AlertContext = createContext<AlertContextProps>({
  success: () => {},
  error: () => {},
  toast: () => {},
});

export const AlertProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [alertState, setAlertState] = useState<Alert | null>(null);
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

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      setToastState((prev) => ({
        message,
        variant,
        seed: (prev?.seed ?? 0) + 1,
      }));
    },
    [],
  );

  const clearToast = useCallback(() => setToastState(null), []);

  // Render the modal (PopUpStatus) directly within the provider.
  const haruka: ImageSource =
    alertState?.type === "success" ? HarukaSuccess : HarukaError;

  const visible: boolean = alertState !== null;

  const handleClose = () => {
    clearAlert();
  };

  const insets = useSafeAreaInsets();
  const dict = useDict();

  const value = useMemo(
    () => ({ success, error, toast }),
    [success, error, toast],
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Portal name="toast">
        {toastState && (
          <View
            pointerEvents="none"
            style={[
              styles.toastWrap,
              { bottom: insets.bottom + THEME.SPACE.XXL },
            ]}
          >
            <Toast
              key={toastState.seed}
              message={toastState.message}
              variant={toastState.variant}
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
          onRequestClose={handleClose}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.container}
          >
            <View style={styles.content} accessibilityViewIsModal>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={dict.A11Y_CLOSE}
                activeOpacity={THEME.OPACITY.PRESSED}
                hitSlop={THEME.HIT_SLOP.MD}
                onPress={handleClose}
                style={styles.closeIcon}
              >
                <Icon
                  name="close"
                  size={THEME.ICON.MD}
                  color={THEME.COLORS.TEXT}
                />
              </TouchableOpacity>
              <Image contentFit="contain" source={haruka} style={styles.img} />
              <Text style={styles.text}>{alertState?.message}</Text>
              <PrimaryButton
                label={dict.OK_BUTTON}
                onPress={handleClose}
                style={styles.okButton}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);
