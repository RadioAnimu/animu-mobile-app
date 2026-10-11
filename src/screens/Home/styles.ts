import { StyleSheet } from "react-native";
import { FLOW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

/** Designer's vertical rhythm between the player sections. */
const RHYTHM = {
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
  timeRemainingWrapper: {
    marginTop: RHYTHM.TIME_TOP,
    marginBottom: RHYTHM.TIME_BOTTOM,
  },
  liveWrapper: {
    marginBottom: RHYTHM.LIVE,
  },
  programWrapper: {
    marginBottom: RHYTHM.PROGRAM,
  },
});
