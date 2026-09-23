import { LayoutAnimation } from "react-native";

/**
 * Schedules an ease-in/ease-out transition for the next layout update —
 * the shared expansion/collapse animation for dropdown rows and panels.
 */
export const layoutEase = (duration = 180): void => {
  LayoutAnimation.configureNext({
    duration,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
  });
};
