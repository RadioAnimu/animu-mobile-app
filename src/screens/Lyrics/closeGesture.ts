import { usePanGesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";

/** A downward swipe on the lyrics' head this long (or this fast) closes it. */
const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 800;

/**
 * The lyrics sheet's dismiss gesture: a deliberate pull down on its head.
 * Shared by the phone's header and the two-pane close handle so both close
 * on the same motion.
 */
export function useCloseGesture(onClose: () => void) {
  return usePanGesture({
    activeOffsetY: 12,
    onDeactivate: (event) => {
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) scheduleOnRN(onClose);
    },
  });
}
