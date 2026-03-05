import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: THEME.COLORS.OVERLAY,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: "100%",
    backgroundColor: THEME.COLORS.PRIMARY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  closeArea: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    height: 35,
    alignItems: "center",
  },
  dragIcon: {
    height: 14,
    resizeMode: "contain",
  },
  trackRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: THEME.COLORS.COVER,
  },
  trackInfo: {
    flex: 1,
    gap: 3,
  },
  songName: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
  animeText: {
    color: THEME.COLORS.CAPTION_500,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
  artistText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.FOOTER,
    opacity: 0.7,
  },
  queueUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  queueText: {
    color: THEME.COLORS.CAPTION_500,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
  noteBox: {
    width: "100%",
  },
  noteText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.SM,
    textAlign: "center",
  },
  input: {
    color: THEME.COLORS.TEXT,
    backgroundColor: THEME.COLORS.WHITE_TEXT,
    textAlign: "left",
    paddingVertical: 5,
    paddingHorizontal: 10,
    width: "100%",
    borderRadius: 8,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: THEME.COLORS.SHAPE,
  },
  username: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
  okButton: {
    marginVertical: 5,
    backgroundColor: THEME.COLORS.SHAPE,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  okButtonError: {
    backgroundColor: THEME.COLORS.ALERT,
  },
  okButtonDisabled: {
    opacity: 0.5,
  },
  okText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
  },
  statusBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.SM,
    textAlign: "center",
  },
  statusSuccess: {
    color: THEME.COLORS.SHAPE,
  },
  statusError: {
    color: THEME.COLORS.ALERT,
  },
});
