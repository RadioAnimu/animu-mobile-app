import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  ModalProps,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import { Image } from "expo-image";
import DragIcon from "@/assets/icons/drag_down.webp";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDict } from "@/hooks/useDict";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { ChipState } from "@/hooks/useChip";
import { Toast } from "@/components/Toast";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { scale } from "@/theme/responsive";
import { CONTINUOUS } from "@/theme/shape";

const CLOSE_AREA_HEIGHT = scale(35);
const DRAG_ICON_HEIGHT = scale(14);
/** A drag past this share of the sheet's height (or a flick) dismisses it. */
const DISMISS_RATIO = 0.25;
/** Release speed (pt/ms) that counts as a downward flick. */
const DISMISS_VELOCITY = 1;
/** Vertical travel (pt) before a touch on the handle counts as a drag. */
const DRAG_SLOP = 4;

interface Props extends ModalProps {
  visible: boolean;
  onClose: () => void;
  /** Blocks backdrop tap, drag handle and Android back while false. */
  closable?: boolean;
  /** Lifts the sheet above the software keyboard. */
  withKeyboard?: boolean;
  /** Max height of the sheet, e.g. "75%". */
  maxHeight?: `${number}%`;
  /**
   * Status chip drawn over the backdrop — the app-level toast sits behind a
   * native Modal, so a sheet carries its own.
   */
  chip?: ChipState | null;
  onChipDone?: () => void;
  children: React.ReactNode;
}

/**
 * The app's one bottom sheet. The scrim fades while the sheet slides up from
 * the bottom edge (both on the native driver), it follows a drag on its
 * handle and dismisses past a quarter of its height or on a flick, and it
 * plays its exit before the modal unmounts. With Reduce Motion the sheet
 * fades in place instead of sliding.
 */
export function Sheet({
  visible,
  onClose,
  closable = true,
  withKeyboard = false,
  maxHeight,
  chip,
  onChipDone,
  children,
  // Destructure the rest of the Modal surface explicitly so override props
  // (animationType, transparent, statusBarTranslucent, …) can't silently
  // come back through `rest` and win over the sheet's invariants.
  ...rest
}: Readonly<Props>) {
  const keyboardPadding = useKeyboardPadding(withKeyboard && visible);
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // The modal stays mounted until the exit animation has played.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  const sheetHeight = useRef(windowHeight);

  useEffect(() => {
    if (!mounted) return undefined;
    if (visible) drag.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? MOTION.DURATION.NORMAL : MOTION.DURATION.FAST,
      easing: visible ? MOTION.EASING.ENTER : MOTION.EASING.EXIT,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, mounted, progress, drag]);

  // Handle drag, on the plain responder props so every value is read in its
  // event handler: the start point and the last sample give the travel and
  // the release velocity.
  const dragStart = useRef({ y: 0, lastY: 0, lastT: 0, velocity: 0 });

  const settleDrag = () => {
    Animated.spring(drag, {
      toValue: 0,
      speed: 24,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handleDragProps = {
    // Capture so a vertical drag wins over the handle's tap-to-close.
    onMoveShouldSetResponderCapture: (event: GestureResponderEvent) =>
      closable &&
      event.nativeEvent.pageY - dragStart.current.y > DRAG_SLOP,
    onStartShouldSetResponderCapture: (event: GestureResponderEvent) => {
      // Record the touch-down point without claiming the touch, so a plain
      // tap still reaches the close button.
      const { pageY, timestamp } = event.nativeEvent;
      dragStart.current = {
        y: pageY,
        lastY: pageY,
        lastT: timestamp,
        velocity: 0,
      };
      return false;
    },
    onResponderTerminationRequest: () => false,
    onResponderMove: (event: GestureResponderEvent) => {
      const { pageY, timestamp } = event.nativeEvent;
      const state = dragStart.current;
      const elapsed = timestamp - state.lastT;
      if (elapsed > 0) state.velocity = (pageY - state.lastY) / elapsed;
      state.lastY = pageY;
      state.lastT = timestamp;
      drag.setValue(Math.max(0, pageY - state.y));
    },
    onResponderRelease: (event: GestureResponderEvent) => {
      const travel = event.nativeEvent.pageY - dragStart.current.y;
      const dismiss =
        travel > sheetHeight.current * DISMISS_RATIO ||
        dragStart.current.velocity > DISMISS_VELOCITY;
      if (dismiss) {
        onClose();
        return;
      }
      settleDrag();
    },
    onResponderTerminate: settleDrag,
  };

  const slide = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reduceMotion ? 0 : windowHeight, 0],
  });

  return (
    <Modal
      visible={mounted}
      {...rest}
      // Sensitive props stay authoritative — after `rest` on purpose. The
      // sheet animates itself, so the modal appears without its own motion.
      animationType="none"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closable ? onClose : undefined}
    >
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.scrim, { opacity: progress }]}
        />
        {/* Decorative tap-away; the labelled close area below is the
            accessible dismiss affordance. */}
        <TouchableOpacity
          accessible={false}
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closable ? onClose : undefined}
        />
        {/* The bottom padding clears the home indicator / Android nav bar
            (Modals are always edge-to-edge since RN 0.86) and, while typing,
            the keyboard — the surface itself runs behind the keyboard so no
            scrim gap opens between them. */}
        <Animated.View
          accessibilityViewIsModal
          onLayout={(event) => {
            sheetHeight.current = event.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            maxHeight != null && { maxHeight },
            {
              paddingBottom: insets.bottom + THEME.SPACE.LG + keyboardPadding,
              opacity: reduceMotion ? progress : 1,
              transform: [{ translateY: Animated.add(slide, drag) }],
            },
          ]}
        >
          <View {...handleDragProps}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={dict.A11Y_CLOSE}
              style={styles.closeArea}
              onPress={closable ? onClose : undefined}
            >
              <Image
                contentFit="contain"
                source={DragIcon}
                style={styles.dragIcon}
              />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
        {chip && (
          <View
            pointerEvents="none"
            style={[styles.chipWrap, { top: insets.top + THEME.SPACE.LG }]}
          >
            <Toast
              key={chip.seed}
              message={chip.message}
              variant={chip.variant}
              onDone={onChipDone}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "column",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.COLORS.SCRIM,
  },
  backdrop: {
    flex: 1,
  },
  chipWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    flexShrink: 1,
    backgroundColor: THEME.COLORS.SURFACE,
    borderTopLeftRadius: THEME.RADIUS.SHEET,
    borderTopRightRadius: THEME.RADIUS.SHEET,
    ...CONTINUOUS,
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
