import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

export const TAIL = scale(9);
const TAIL_OFFSET = scale(14);

export const styles = StyleSheet.create({
  bubble: {
    borderRadius: THEME.RADIUS.CARD,
  },
  tail: {
    position: "absolute",
    width: 0,
    height: 0,
    borderTopWidth: TAIL,
    borderBottomWidth: TAIL,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  // Received: tail at the top, pointing at the speaker on the left.
  tailLeft: {
    left: -TAIL + 1,
    top: TAIL_OFFSET,
    borderRightWidth: TAIL,
    borderLeftWidth: 0,
  },
  // Sent: tail at the bottom, pointing at the sender on the right.
  tailRight: {
    right: -TAIL + 1,
    bottom: TAIL_OFFSET,
    borderLeftWidth: TAIL,
    borderRightWidth: 0,
  },
});
