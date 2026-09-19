import React, { useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  ModalProps,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import DragIcon from "@/assets/icons/drag_down.png";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDict } from "@/hooks/useDict";
import { THEME } from "@/theme";

const CLOSE_AREA_HEIGHT = 35;
const DRAG_ICON_HEIGHT = 14;

/**
 * Bottom padding equal to the software keyboard height.
 *
 * We don't use RN's `KeyboardAvoidingView`: on Android edge-to-edge (SDK 57,
 * targetSdk 36) it handles `keyboardDidHide` through `_onKeyboardChange`, so it
 * recomputes padding from the hide event's `screenY` — which is reported wrong
 * in edge-to-edge — and leaves a transparent gap behind after the keyboard
 * closes (the sheet stays "floating"). Here the hide event is always ignored
 * and the padding is reset to 0.
 */
function useKeyboardPadding(enabled: boolean): number {
  const [padding, setPadding] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPadding(0);
      return;
    }

    const animate = () =>
      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

    const subscriptions = [
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        (event) => {
          animate();
          setPadding(event.endCoordinates.height);
        },
      ),
      Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        () => {
          animate();
          setPadding(0);
        },
      ),
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [enabled]);

  return enabled ? padding : 0;
}

interface Props extends ModalProps {
  visible: boolean;
  onClose: () => void;
  /** Blocks backdrop tap, drag handle and Android back while false. */
  closable?: boolean;
  /** Lifts the sheet above the software keyboard. */
  withKeyboard?: boolean;
  /** Max height of the sheet, e.g. "75%". */
  maxHeight?: `${number}%`;
  children: React.ReactNode;
}

export function Sheet({
  visible,
  onClose,
  closable = true,
  withKeyboard = false,
  maxHeight,
  children,
  ...rest
}: Props) {
  const keyboardPadding = useKeyboardPadding(withKeyboard && visible);
  const insets = useSafeAreaInsets();
  const dict = useDict();

  const body = (children: React.ReactNode) => (
    <View style={[styles.overlay, { paddingBottom: keyboardPadding }]}>
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={closable ? onClose : undefined}
      {...rest}
    >
      {body(
        <>
          {/* Decorative tap-away; the labelled close area below is the
              accessible dismiss affordance. */}
          <TouchableOpacity
            accessible={false}
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closable ? onClose : undefined}
          />
          {/* Bottom padding clears the system nav/home indicator bar: since
              RN 0.86 Android Modals are always edge-to-edge, so a fixed pad
              would sit the last row under the nav bar. */}
          <View
            style={[
              styles.sheet,
              maxHeight != null && { maxHeight },
              { paddingBottom: insets.bottom + THEME.SPACE.XXXL },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_CLOSE}
              style={styles.closeArea}
              onPress={closable ? onClose : undefined}
            >
              <Image source={DragIcon} style={styles.dragIcon} />
            </TouchableOpacity>
            {children}
          </View>
        </>,
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: THEME.COLORS.SCRIM,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: "100%",
    backgroundColor: THEME.COLORS.SURFACE,
    borderTopLeftRadius: THEME.RADIUS.SHEET,
    borderTopRightRadius: THEME.RADIUS.SHEET,
  },
  closeArea: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    height: CLOSE_AREA_HEIGHT,
    alignItems: "center",
  },
  dragIcon: {
    height: DRAG_ICON_HEIGHT,
    resizeMode: "contain",
  },
});
