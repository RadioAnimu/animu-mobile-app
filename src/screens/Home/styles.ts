import { StyleSheet } from "react-native";
import { FLOW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";
import { THEME } from "@/theme";

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
 * The two-pane (split) composition. Widths and gaps that depend on the
 * window are inline (from `resolveSplitMetrics`); what is fixed lives here.
 */
export const splitStyles = StyleSheet.create({
  /** Centers the panes and the ticker as one block in the scroll view. */
  root: {
    alignItems: "center",
  },
  panes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pane: {
    alignItems: "center",
  },
  // Same full-bleed ticker as the stack, set under the panes like the
  // website's song lines under its hero.
  liveWrapper: {
    alignSelf: "stretch",
    marginTop: THEME.SPACE.MD,
  },
  // The countdown sits at the foot of the art column: no gap below it.
  timeRemainingWrapper: {
    alignSelf: "stretch",
    marginTop: RHYTHM.TIME_TOP,
  },
  programWrapper: {
    marginBottom: RHYTHM.PROGRAM,
  },
});

/** Content container of the scroll view when the block is centered in it. */
export const centeredContent = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
}).content;
