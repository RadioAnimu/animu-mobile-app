import { StyleSheet } from "react-native";

/** Designer's vertical rhythm between the player sections. */
const RHYTHM = {
  LISTENERS: 10,
  COVER: 11,
  TIME_TOP: 10,
  TIME_BOTTOM: 8,
  LIVE: 9,
  PROGRAM: 9,
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
