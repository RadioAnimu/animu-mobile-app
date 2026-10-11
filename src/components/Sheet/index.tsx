import React, { useRef, useState } from "react";
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
import { usePresence } from "@/hooks/usePresence";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { ChipState } from "@/hooks/useChip";
import { Toast } from "@/components/Toast";
import { THEME } from "@/theme";
import { MOTION } from "@/theme/motion";
import { scale } from "@/theme/responsive";
import { CONTINUOUS } from "@/theme/shape";

/** The drag handle artwork's height; its width follows the asset's ratio. */
const DRAG_ICON_HEIGHT = scale(14);
const DRAG_ICON_RATIO = 156 / 92;
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
 * The app's one bottom sheet. The scrim fades while the sheet slides up by
 * its own height (both on the native driver, so the whole short duration is
 * visible travel rather than mostly off-screen), it follows a drag on its
 * handle and dismisses past a quarter of its height or on a flick, and it
 * plays its exit before the modal unmounts. With Reduce Motion the sheet
 * fades in place instead of sliding.
 *
 * Forms inside a sheet use `KeyboardScrollView variant="sheet"`: the content
 * grows by the keyboard's height, so the sheet rides up above the keyboard
 * (and, once it reaches the top, scrolls the focused field into view).
 */
export function Sheet({
  visible,
  onClose,
  closable = true,
  maxHeight,
  chip,
  onChipDone,
  children,
  // Destructure the rest of the Modal surface explicitly so override props
  // (animationType, transparent, statusBarTranslucent, …) can't silently
  // come back through `rest` and win over the sheet's invariants.
  ...rest
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const dict = useDict();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // The modal stays mounted until the exit animation has played.
  const { mounted, progress } = usePresence(visible);

  const [drag] = useState(() => new Animated.Value(0));
  // Starts at the window height (the first frame is off-screen whatever the
  // sheet measures), then the sheet's own height once laid out.
  const [travel] = useState(() => new Animated.Value(windowHeight));
  const sheetHeight = useRef(windowHeight);

  // A fresh presentation starts from rest, not from the last drag offset.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) drag.setValue(0);
  }

  // Handle drag, on the plain responder props so every value is read in its
  // event handler: the start point and the last sample give the travel and
  // the release velocity.
  const dragStart = useRef({ y: 0, lastY: 0, lastT: 0, velocity: 0 });

  const settleDrag = () => {
    Animated.spring(drag, {
      toValue: 0,
      ...MOTION.SETTLE_SPRING,
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

  // (1 - progress) × travel: fully hidden below at 0, in place at 1.
  const slide = reduceMotion
    ? 0
    : Animated.multiply(
        progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        travel,
      );

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
            (Modals are always edge-to-edge since RN 0.86). While typing, the
            sheet's keyboard-aware content supplies the room above the
            keyboard; the surface itself runs on behind the keyboard so no
            scrim gap opens between them. */}
        <Animated.View
          accessibilityViewIsModal
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            sheetHeight.current = height;
            travel.setValue(height);
          }}
          style={[
            styles.sheet,
            maxHeight != null && { maxHeight },
            {
              paddingBottom: insets.bottom + THEME.LAYOUT.SHEET_END_GAP,
              opacity: reduceMotion ? progress : 1,
              transform: [{ translateY: Animated.add(slide, drag) }],
            },
          ]}
        >
          <View {...handleDragProps}>
            <TouchableOpacity
              activeOpacity={THEME.OPACITY.PRESSED}
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
    // A full touch target for tap-to-close; the drag starts anywhere on it.
    height: THEME.LAYOUT.TOUCH_TARGET,
    alignItems: "center",
  },
  dragIcon: {
    height: DRAG_ICON_HEIGHT,
    // expo-image needs an explicit width; it can't infer one from a height.
    width: DRAG_ICON_HEIGHT * DRAG_ICON_RATIO,
  },
});
