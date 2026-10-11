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
import { Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@/components/Icon";
import HarukaError from "@/assets/error_haruka.webp";
import HarukaSuccess from "@/assets/success_haruka.webp";
import { THEME } from "@/theme";
import { styles } from "@/contexts/alert/styles";
import { Portal } from "@/contexts/Portal";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Toast, type ToastVariant } from "@/components/Toast";
import { useDict } from "@/hooks/useDict";
import { usePresence } from "@/hooks/usePresence";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { haptics } from "@/utils/haptics";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AlertType = "success" | "error" | null;

interface Alert {
  message: string;
  type: AlertType;
}

/** A confirmation reads in a glance; it clears itself after this long. */
const SUCCESS_HOLD_MS = 3000;

/** The dialog grows into place from this scale (Reduce Motion: fade only). */
const DIALOG_ENTER_SCALE = 0.94;

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
    // Clear the previous timer first — a second alert arriving within the
    // window must not be dismissed by the first alert's pending timeout.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    // A success is a confirmation and clears itself; an error explains what
    // went wrong and stays until the user has read it and dismissed it.
    if (type !== "success") return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setAlertState(null);
    }, SUCCESS_HOLD_MS);
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
      haptics.error();
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

  const visible: boolean = alertState !== null;
  // The dialog keeps its last content while it plays its exit.
  const [shown, setShown] = useState<Alert | null>(alertState);
  if (alertState && alertState !== shown) setShown(alertState);
  const { mounted, progress } = usePresence(visible);
  const reduceMotion = useReducedMotion();

  const haruka: ImageSource =
    shown?.type === "success" ? HarukaSuccess : HarukaError;

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
        {/* Rides up with the keyboard (frame-synced), so a toast raised
            while typing — "code sent", a failed send — is never hidden
            behind it. The keyboard covers the bottom inset, which is handed
            back once open so the gap above the keyboard matches the gap
            above the home indicator. */}
        {toastState && (
          <KeyboardStickyView
            pointerEvents="none"
            offset={{ opened: insets.bottom }}
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
          </KeyboardStickyView>
        )}
      </Portal>
      <Portal name="alert">
        {/* Same presentation as the sheets: the modal itself appears without
            motion and the scrim + card animate on the native driver at the
            app's tempo (the OS fade is slower and differs per platform). */}
        <Modal
          animationType="none"
          visible={mounted}
          statusBarTranslucent
          navigationBarTranslucent
          transparent
          onRequestClose={handleClose}
        >
          <View style={styles.container}>
            <Animated.View
              pointerEvents="none"
              style={[styles.scrim, { opacity: progress }]}
            />
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: progress,
                  transform: [
                    {
                      scale: reduceMotion
                        ? 1
                        : progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [DIALOG_ENTER_SCALE, 1],
                          }),
                    },
                  ],
                },
              ]}
              accessibilityViewIsModal
            >
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
              <Text
                accessibilityRole={shown?.type === "error" ? "alert" : undefined}
                style={styles.text}
              >
                {shown?.message}
              </Text>
              <PrimaryButton
                label={dict.OK_BUTTON}
                onPress={handleClose}
                style={styles.okButton}
              />
            </Animated.View>
          </View>
        </Modal>
      </Portal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);
