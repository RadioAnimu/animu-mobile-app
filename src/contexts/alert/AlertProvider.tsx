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
import { ALL_ORIENTATIONS } from "@/theme/layout";
import { IMG_HEIGHT, styles } from "@/contexts/alert/styles";
import { Portal } from "@/contexts/Portal";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Toast, type ToastVariant } from "@/components/Toast";
import { useDict } from "@/hooks/useDict";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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
  /** Optional trailing chip action ("Undo"); dropped when the chip is replaced. */
  action?: ToastAction;
  /** Bumped on every call so re-triggering remounts (fresh fade animation). */
  seed: number;
}

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface AlertContextProps {
  success: (message: string) => void;
  error: (message: string) => void;
  /**
   * Minimalist flash chip at the bottom — auto-dismisses. Errors stay on
   * screen longer than successes, and an optional `options.action` turns
   * the chip into an interactive undo-style snackbar that holds longer.
   */
  toast: (
    message: string,
    variant?: ToastVariant,
    options?: { action?: ToastAction },
  ) => void;
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
    (
      message: string,
      variant: ToastVariant = "success",
      options?: { action?: ToastAction },
    ) => {
      setToastState((prev) => ({
        message,
        variant,
        // The undo window closes with the chip — a replacement drops the old action.
        action: options?.action,
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
  // Short windows (landscape phones) cannot hold the full dialog card.
  const layout = useResponsiveLayout();

  // In a short window Haruka's band gives way to the message: a third of the
  // window height so the close, the text and the button still fit. Portrait
  // keeps the full artwork band untouched.
  const harukaStyle = layout.short
    ? [
        styles.img,
        { height: Math.min(IMG_HEIGHT, Math.round(layout.height * 0.3)) },
      ]
    : styles.img;

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
            above the home indicator. The band spans the screen, so when the
            chip is interactive it must hand touches back ("box-none") —
            only the chip itself answers them. */}
        {toastState && (
          <KeyboardStickyView
            pointerEvents={toastState.action ? "box-none" : "none"}
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
              action={toastState.action}
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
          supportedOrientations={ALL_ORIENTATIONS}
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
              <Image
                contentFit="contain"
                source={haruka}
                style={harukaStyle}
              />
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
