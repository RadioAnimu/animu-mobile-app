import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CARD_RADIUS = THEME.RADIUS.CARD;
const BANNER_HEIGHT = scale(96);
const AVATAR = scale(84);
// Shared content inset + row rhythm with Settings.
const CONTENT_PADDING = THEME.SPACE.LG;

export { AVATAR };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  content: {
    flexGrow: 1,
    width: THEME.LAYOUT.CONTENT_WIDTH,
    maxWidth: THEME.LAYOUT.CONTENT_MAX_WIDTH,
    alignSelf: "center",
    // Same inset under the header as Settings and Login.
    paddingTop: THEME.SPACE.XXL,
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
    height: scale(48),
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
    borderRadius: CARD_RADIUS,
    backgroundColor: THEME.COLORS.SURFACE,
    overflow: "hidden",
  },
  // Floating over the banner so the identity card owns the refresh action
  // instead of an orphaned full-width bar under it.
  refreshButton: {
    position: "absolute",
    top: THEME.SPACE.MD,
    right: THEME.SPACE.MD,
    width: scale(40),
    height: scale(40),
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonBusy: {
    opacity: THEME.OPACITY.DISABLED,
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
    paddingHorizontal: CONTENT_PADDING,
  },
  avatarWrap: {
    marginTop: -AVATAR / 2,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: scale(3),
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
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
  },
  identityInfo: {
    flex: 1,
    // minWidth: 0 lets the column shrink below its content width so the
    // revealed email + eye truncate with an ellipsis instead of pushing the
    // provider action off-screen at 360dp.
    minWidth: 0,
    paddingLeft: CONTENT_PADDING,
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
    paddingVertical: scale(3),
    borderRadius: THEME.RADIUS.CIRCLE,
  },
  badgeSuccess: {
    backgroundColor: THEME.COLORS.BRAND_SUBTLE,
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
  group: {
    backgroundColor: THEME.COLORS.SURFACE,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
  },
  // Danger zone: the destructive actions as separate outlined cards, matching
  // the reset action on the Settings screen.
  dangerActions: {
    gap: THEME.SPACE.MD,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
    marginLeft: CONTENT_PADDING,
  },
  // Same row rhythm as Settings and Select: a fixed minimum height with the
  // vertical air coming from the body (or the min height when the row is a
  // single line).
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
  },
  // Same centered 32px icon slot the Settings rows use, so a provider/brand
  // mark lines up with the section heading above it.
  rowIconCenter: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    height: THEME.ICON.MD,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    // Same shrink contract as identityInfo — the linked identity (a long
    // masked email) must wrap/ellipsize before it can push the action out.
    minWidth: 0,
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
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
  // Icon-only link/unlink affordance: a fixed 40px square keeps the tap
  // target generous while freeing the horizontal budget a text action used
  // to eat at small widths (the rowCaption's whole wrapping problem).
  rowIconAction: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
    marginLeft: THEME.SPACE.XS,
  },
  rowActionBusy: {
    width: scale(40),
    marginLeft: THEME.SPACE.XS,
  },
  rowActionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  soon: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
    paddingLeft: THEME.SPACE.MD,
  },
});
