import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const HEADER_IMAGE_HEIGHT = scale(127);
const ROW_COVER = scale(50);

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    width: "85%",
    marginBottom: THEME.SPACE.LG,
    alignSelf: "center",
  },
  headerImage: {
    width: "100%",
    height: HEADER_IMAGE_HEIGHT,
    marginVertical: THEME.SPACE.LG,
  },
  nameTouchable: {
    flex: 1,
    minHeight: scale(44),
    justifyContent: "center",
  },
  trackName: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LIST,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    flex: 1,
  },
  containerList: {
    gap: THEME.SPACE.MD,
  },
  listWrapper: {
    width: "100%",
    flex: 1,
  },
  trackTime: {
    color: THEME.COLORS.TEXT,
    fontSize: THEME.FONT_SIZE.LIST,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    marginLeft: "auto",
  },
  metadata: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: THEME.SPACE.MD,
    alignItems: "center",
    minWidth: "100%",
  },
  image: {
    width: ROW_COVER,
    height: ROW_COVER,
    borderRadius: THEME.RADIUS.XL,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: scale(2),
  },
});
