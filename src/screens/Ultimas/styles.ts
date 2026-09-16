import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

const HEADER_IMAGE_HEIGHT = 127;
const ROW_COVER = 50;
/** Fixed row height for `getItemLayout` (cover 50px dominates the row). */
export const ROW_HEIGHT = ROW_COVER;
/** Vertical rhythm: the row container gap lives IN the list, spacing rows. */
export const ROW_GAP = THEME.SPACE.MD;

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
  ultimasPedidasImage: {
    width: "100%",
    height: HEADER_IMAGE_HEIGHT,
    marginVertical: THEME.SPACE.LG,
  },
  nameTouchable: {
    flex: 1,
  },
  musicapedidaname: {
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
  musicapedidatime: {
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
    // Fixed geometry — rows must keep the same height whether the cover
    // setting is on or off, or getItemLayout's offsets drift by theme.
    height: ROW_COVER,
  },
  image: {
    width: ROW_COVER,
    height: ROW_COVER,
    borderRadius: THEME.RADIUS.XL,
    borderColor: THEME.COLORS.FRAME,
    borderWidth: 2,
  },
});
