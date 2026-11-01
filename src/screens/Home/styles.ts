import { StyleSheet } from "react-native";
import { FLOW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

/** Designer's vertical rhythm between the player sections. */
export const RHYTHM = {
  LISTENERS: scale(10),
  COVER: scale(11),
  // Together with COVER above, the time sits centered between the cover and
  // the info block (14.5 each side; the 29 total is unchanged).
  TIME_TOP: scale(3.5),
  TIME_BOTTOM: scale(14.5),
  LIVE: scale(9),
  PROGRAM: scale(9),
};

export const styles = StyleSheet.create({
  container: FLOW_STYLES.container,
  containerApp: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  logoAndOscilloscope: {
    alignItems: "center",
  },
  listenersWrapper: {
    marginBottom: RHYTHM.LISTENERS,
  },
  coverWrapper: {
    marginBottom: RHYTHM.COVER,
  },
  // Full width: the row's messages overlay a fixed-height slot and must not
  // be clipped to the narrower countdown that sizes it.
  timeRemainingWrapper: {
    alignSelf: "stretch",
    marginTop: RHYTHM.TIME_TOP,
    marginBottom: RHYTHM.TIME_BOTTOM,
  },
  // The ticker is full-bleed: stretch out of the centered column.
  liveWrapper: {
    alignSelf: "stretch",
    marginBottom: RHYTHM.LIVE,
  },
  programWrapper: {
    marginBottom: RHYTHM.PROGRAM,
  },
});

/**
 * The landscape (website hero) composition. Widths that depend on the
 * window are inline (from `resolveSplitMetrics`); what is fixed lives here.
 */
export const splitStyles = StyleSheet.create({
  // The hero keeps the player's own rhythm from the header: the same gap
  // above it as under its countdown, as between the cover and countdown.
  page: {
    flexGrow: 1,
    alignItems: "center",
  },
  /** The free height above the strip, the hero centered in it. */
  heroArea: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: RHYTHM.TIME_BOTTOM,
  },
  /** The art and the cover block side by side, centered as one. */
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverColumn: {
    alignItems: "center",
  },
  /** The program's art with the program and DJ centered under it. */
  programColumn: {
    alignItems: "center",
    gap: RHYTHM.PROGRAM,
  },
  listenersWrapper: {
    marginBottom: RHYTHM.LISTENERS,
  },
  coverWrapper: {
    marginBottom: RHYTHM.COVER,
  },
  // Full column width: the countdown's messages overlay a fixed-height slot.
  timeRemainingWrapper: {
    alignSelf: "stretch",
    marginTop: RHYTHM.TIME_TOP,
  },
  // The ticker is full-bleed, as in portrait.
  // At the bottom of the screen, full-bleed, as in portrait.
  liveWrapper: {
    alignSelf: "stretch",
  },
});

/** Content container of the scroll view when the page fills its height. */
export const fillContent = StyleSheet.create({ content: { flexGrow: 1 } }).content;

/** Content container of the scroll view when the block is centered in it. */
export const centeredContent = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
}).content;
