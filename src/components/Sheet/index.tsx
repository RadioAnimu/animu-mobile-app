import React from "react";
import { Modal, ModalProps, StyleSheet, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import DragIcon from "@/assets/icons/drag_down.webp";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDict } from "@/hooks/useDict";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CLOSE_AREA_HEIGHT = scale(35);
const DRAG_ICON_HEIGHT = scale(14);

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
  // Destructure the rest of the Modal surface explicitly so override props
  // (animationType, transparent, statusBarTranslucent, …) can't silently
  // come back through `rest` and win over the sheet's invariants.
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
      {...rest}
      // Sensitive props stay authoritative — after `rest` on purpose.
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={closable ? onClose : undefined}
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
            accessibilityViewIsModal
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
              <Image contentFit="contain" source={DragIcon} style={styles.dragIcon} />
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
    // expo-image needs an explicit width; it can't infer one from a height.
    width: DRAG_ICON_HEIGHT * (156 / 92),
  },
});
