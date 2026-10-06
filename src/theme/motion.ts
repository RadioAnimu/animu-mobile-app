import { Easing } from "react-native";

/**
 * The app's motion system. Every transition picks one of these durations so
 * the whole UI moves at one tempo; the smallest step that still reads as
 * motion wins — this app should feel fast, never sluggish.
 *
 * - FAST: state feedback (pressed, toggles, chips appearing, list reflow).
 * - NORMAL: elements entering/leaving (sheets, toasts, screen content).
 * - SLOW: the rare large surface that travels far (full sheet dismissal).
 */
export const MOTION = {
  DURATION: {
    INSTANT: 0,
    FAST: 75,
    NORMAL: 110,
    SLOW: 150,
    SPLASH: 125,
  },
  STAGGER: 20,
  /** Reading/caret rhythms are not navigation transitions. */
  CARET_HALF: 550,
  PULSE_HALF: 650,
  SPRING: { speed: 60, bounciness: 0 },
  /** Elements arriving decelerate into place; leaving ones accelerate out. */
  EASING: {
    ENTER: Easing.out(Easing.cubic),
    EXIT: Easing.in(Easing.cubic),
    STANDARD: Easing.inOut(Easing.cubic),
  },
  /** Small entrance offset (pt) for content that rises into place. */
  RISE: 12,
} as const;
