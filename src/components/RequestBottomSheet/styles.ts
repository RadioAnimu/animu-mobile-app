import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const COVER = 64;
const AVATAR = 36;

export const styles = StyleSheet.create({
  scrollContent: {
    gap: THEME.SPACE.LG,
    paddingHorizontal: THEME.SPACE.LG,
    paddingBottom: THEME.SPACE.SM,
  },
  trackRow: {
    flexDirection: "row",
    gap: THEME.SPACE.MD,
    alignItems: "center",
  },
  cover: {
    width: COVER,
    height: COVER,
    borderRadius: THEME.RADIUS.MD,
    borderWidth: 2,
    borderColor: THEME.COLORS.FRAME,
  },
  trackInfo: {
    flex: 1,
    gap: THEME.SPACE.XS,
  },
  songName: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  animeText: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  artistText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    opacity: THEME.OPACITY.SOFT,
  },
  noteBox: {
    width: "100%",
  },
  noteText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
  },
  input: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    backgroundColor: THEME.COLORS.TEXT,
    textAlign: "left",
    paddingVertical: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.MD,
    width: "100%",
    borderRadius: THEME.RADIUS.MD,
  },
  inputDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 2,
    borderColor: THEME.COLORS.BRAND,
  },
  username: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  okButton: {
    marginVertical: THEME.SPACE.XS,
    backgroundColor: THEME.COLORS.BRAND,
    paddingVertical: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.XL,
    borderRadius: THEME.RADIUS.MD,
    alignItems: "center",
  },
  okButtonError: {
    backgroundColor: THEME.COLORS.ERROR,
  },
  okButtonDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  okText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  statusBox: {
    alignItems: "center",
    gap: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
  },
  statusText: {
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
  },
  statusSuccess: {
    color: THEME.COLORS.BRAND,
  },
  statusError: {
    color: THEME.COLORS.ERROR,
  },
});
