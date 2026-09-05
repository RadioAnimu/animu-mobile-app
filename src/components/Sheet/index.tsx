import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import DragIcon from "../../assets/icons/ArrastarParaBaixo.png";
import { THEME } from "../../theme";

const CLOSE_AREA_HEIGHT = 35;
const DRAG_ICON_HEIGHT = 14;

interface Props extends ModalProps {
  visible: boolean;
  onClose: () => void;
  /** Blocks backdrop tap, drag handle and Android back while false. */
  closable?: boolean;
  /** Wraps content in a KeyboardAvoidingView (ios: padding, android: height). */
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
  const behavior = Platform.OS === "ios" ? "padding" : "height";

  const body = (children: React.ReactNode) =>
    withKeyboard ? (
      <KeyboardAvoidingView behavior={behavior} style={styles.overlay}>
        {children}
      </KeyboardAvoidingView>
    ) : (
      <View style={styles.overlay}>{children}</View>
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
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closable ? onClose : undefined}
          />
          <View style={[styles.sheet, maxHeight != null && { maxHeight }]}>
            <TouchableOpacity
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
    paddingBottom: THEME.SPACE.XXXL,
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
