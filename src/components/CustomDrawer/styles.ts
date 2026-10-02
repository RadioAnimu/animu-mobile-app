import { StyleSheet } from "react-native";
import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";
import { CONTINUOUS, avatarRadius, concentric } from "@/theme/shape";

const AVATAR = scale(40);
// Rows hug the 40px rounded-square avatar by its vertical padding.
const ROW_RADIUS = concentric(avatarRadius(AVATAR), THEME.SPACE.SM);

export const DRAWER_GRID = {
  SCREEN_MARGIN: scale(12),
};

export const styles = StyleSheet.create({
  iconBox: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "center",
  },
  header: {
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    marginTop: THEME.SPACE.MD,
  },
  logoButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: THEME.SPACE.SM,
    marginBottom: THEME.SPACE.XS,
  },
  bottom: {
    marginTop: "auto",
    minHeight: scale(76),
    borderTopWidth: 1,
    borderTopColor: THEME.COLORS.HAIRLINE,
    paddingBottom: THEME.SPACE.LG,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    borderRadius: ROW_RADIUS,
    ...CONTINUOUS,
  },
  accountIdentity: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
    borderRadius: ROW_RADIUS,
    ...CONTINUOUS,
  },
  accountIdentityGrow: {
    flex: 1,
  },
  gearButton: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: avatarRadius(AVATAR),
    ...CONTINUOUS,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  accountIconBox: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: {
    flex: 1,
    gap: THEME.SPACE.XXS,
    marginLeft: THEME.SPACE.MD,
  },
  accountName: ROW_STYLES.label,
  accountCaption: ROW_STYLES.caption,
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    paddingHorizontal: THEME.SPACE.MD,
    marginTop: scale(18),
    marginBottom: THEME.SPACE.SM,
    paddingBottom: THEME.SPACE.MD,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.HAIRLINE,
  },
  sectionText: {
    flex: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    letterSpacing: THEME.LETTER_SPACING.CAPS,
    marginLeft: THEME.SPACE.SM,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: DRAWER_GRID.SCREEN_MARGIN,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    borderRadius: ROW_RADIUS,
    ...CONTINUOUS,
  },
  navItemFocused: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  navItemLocked: {
    opacity: THEME.OPACITY.DISABLED,
  },
  navItemText: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    marginLeft: THEME.SPACE.SM,
  },
  navItemTextFocused: {
    color: THEME.COLORS.SURFACE,
  },
});
