import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const HEADER_HEIGHT = 72;
const HEADER_BUTTON = 44;
const CARD_RADIUS = 14;
const ICON_BOX_WIDTH = 32;
const BANNER_HEIGHT = 96;
const AVATAR = 84;

export { HEADER_HEIGHT, AVATAR };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  header: {
    width: "100%",
    backgroundColor: THEME.COLORS.SURFACE,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  headerButton: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  content: {
    flexGrow: 1,
    width: "88%",
    alignSelf: "center",
    paddingBottom: THEME.SPACE.XXXL,
  },
  signedOut: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.XL,
  },
  signedOutText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
  },
  primaryButton: {
    height: 48,
    paddingHorizontal: THEME.SPACE.XXL,
    borderRadius: CARD_RADIUS,
    backgroundColor: THEME.COLORS.BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  card: {
    marginTop: THEME.SPACE.XL,
    borderRadius: CARD_RADIUS,
    backgroundColor: THEME.COLORS.SURFACE,
    overflow: "hidden",
  },
  banner: {
    height: BANNER_HEIGHT,
    width: "100%",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  identity: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: THEME.SPACE.MD,
  },
  avatarWrap: {
    marginTop: -AVATAR / 2,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 3,
    borderColor: THEME.COLORS.SURFACE,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: THEME.RADIUS.CIRCLE,
  },
  verifiedInfo: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: 19,
    paddingHorizontal: THEME.SPACE.MD,
    paddingTop: THEME.SPACE.MD,
  },
  identityInfo: {
    flex: 1,
    paddingLeft: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.SM,
    gap: THEME.SPACE.XXS,
  },
  name: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
  },
  caption: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  badges: {
    flexDirection: "row",
    marginTop: THEME.SPACE.XXS,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: 3,
    borderRadius: THEME.RADIUS.CIRCLE,
  },
  badgeSuccess: {
    backgroundColor: "rgba(107, 219, 0, 0.15)",
  },
  badgeMuted: {
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  badgeText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  badgeTextSuccess: {
    color: THEME.COLORS.BRAND,
  },
  meta: {
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.MD,
    gap: THEME.SPACE.XS,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
  },
  metaText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    height: 48,
    marginTop: THEME.SPACE.MD,
    borderRadius: CARD_RADIUS,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
  },
  refreshText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: THEME.SPACE.MD,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingHorizontal: THEME.SPACE.MD,
    paddingVertical: THEME.SPACE.SM,
  },
  rowIcon: {
    width: ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  rowBody: {
    flex: 1,
    gap: THEME.SPACE.XXS,
  },
  rowLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  rowCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  rowAction: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    paddingLeft: THEME.SPACE.MD,
  },
  rowActionDisabled: {
    color: THEME.COLORS.TEXT_DIM,
  },
  soon: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
    paddingLeft: THEME.SPACE.MD,
  },
  dangerText: {
    color: THEME.COLORS.ERROR,
  },
});
