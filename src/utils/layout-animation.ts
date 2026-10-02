import { LayoutAnimation } from "react-native";

import { MOTION } from "@/theme/motion";

/**
 * Schedules an ease-in/ease-out transition for the next layout update —
 * the shared expansion/collapse animation for dropdown rows and panels.
 */
export const layoutEase = (duration: number = MOTION.DURATION.FAST): void => {
  LayoutAnimation.configureNext({
    duration,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
};
