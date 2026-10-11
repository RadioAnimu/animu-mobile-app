import { Easing } from "react-native";

/**
 * The app's motion system. Every transition picks one of these durations so
 * the whole UI moves at one tempo; the smallest step that still reads as
 * motion wins — this app should feel snappy, never sluggish, but never
 * instant either (a surface that pops in gives no sense of where it came
 * from).
 *
 * - FAST: state feedback (pressed, toggles, chips appearing, list reflow,
 *   a surface leaving).
 * - NORMAL: elements entering (sheets, dialogs, toasts, screen content).
 * - SLOW: the rare large surface that travels far.
 * - SCREEN: a whole page arriving (the lyrics page rising, the Reduce
 *   Motion cross-fade between pages) — half the native stack's 500ms.
 *   The platform push/pop itself stays native and untouched.
 */
export const MOTION = {
  DURATION: {
    FAST: 75,
    NORMAL: 110,
    SLOW: 150,
    SCREEN: 250,
  },
  /** Elements arriving decelerate into place; leaving ones accelerate out. */
  EASING: {
    ENTER: Easing.out(Easing.cubic),
    EXIT: Easing.in(Easing.cubic),
    STANDARD: Easing.inOut(Easing.cubic),
  },
  /** Small entrance offset (pt) for content that rises into place. */
  RISE: 12,
  /** Gap between the entrance of consecutive blocks — a beat, not a wait. */
  STAGGER: 20,
  /**
   * Snap-back after a released drag: critically damped (no wobble) and
   * stiff enough to settle inside the FAST budget.
   */
  SETTLE_SPRING: { speed: 40, bounciness: 0 },
  /** Half-period of a text caret / "still working" blink. */
  BLINK: 550,
} as const;
