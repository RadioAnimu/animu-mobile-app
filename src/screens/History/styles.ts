import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { FLOW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const HEADER_IMAGE_HEIGHT = THEME.LAYOUT.LOGO_HEIGHT;
const ROW_COVER = THEME.LAYOUT.THUMB.SM;

export const styles = StyleSheet.create({
  container: FLOW_STYLES.container,
  appContainer: FLOW_STYLES.appContainer,
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
  emptyText: {
    color: THEME.COLORS.TEXT_DIM,
    fontSize: THEME.FONT_SIZE.BODY,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    textAlign: "center",
    paddingVertical: THEME.SPACE.XL,
  },
  listWrapper: FLOW_STYLES.listWrapper,
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
