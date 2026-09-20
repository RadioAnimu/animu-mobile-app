import { StyleSheet } from "react-native";
import { scale } from "@/theme/responsive";

/** Designer's vertical rhythm between the player sections. */
const RHYTHM = {
  LISTENERS: scale(10),
  COVER: scale(11),
  TIME_TOP: scale(10),
  TIME_BOTTOM: scale(8),
  LIVE: scale(9),
  PROGRAM: scale(9),
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
