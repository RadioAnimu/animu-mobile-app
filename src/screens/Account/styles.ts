import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

// Twitter header proportions: a wide cover with the avatar hanging off its
// bottom-left.
const BANNER_HEIGHT = scale(104);
const AVATAR = scale(72);
// Shared content inset + row rhythm with Settings.
const CONTENT_PADDING = THEME.SPACE.LG;

export { AVATAR };

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  content: SCREEN_STYLES.content,
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
    borderRadius: THEME.RADIUS.CARD,
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
    borderRadius: THEME.RADIUS.CARD,
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
  // Floating over the cover so the refresh action stays reachable without an
  // orphaned toolbar.
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
  // Avatar sits below the cover's left edge, name block beside it — the
  // classic Twitter header arrangement. The name/handle column is centered
  // against the avatar so it reads as one unit with it.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.LG,
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: THEME.SPACE.MD,
  },
  avatarWrap: {
    marginTop: -AVATAR * 0.5,
    borderRadius: scale(14),
    borderWidth: scale(4),
    borderColor: THEME.COLORS.SURFACE,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: scale(10),
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: THEME.SPACE.XXS,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
  },
  name: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
  },
  caption: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  verifiedInfo: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: THEME.SPACE.SM,
  },
  // Twitter stats strip: small label over a value, split from the identity
  // block by a hairline.
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME.SPACE.XL,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.COLORS.HAIRLINE,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.LG,
  },
  statItem: {
    gap: THEME.SPACE.XXS,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  statLabel: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  statValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  group: SCREEN_STYLES.group,
  // Danger zone: one shared danger card holding the destructive actions,
  // mirroring the grouped-row pattern used everywhere else.
  dangerGroup: {
    backgroundColor: THEME.COLORS.DANGER,
    borderRadius: THEME.RADIUS.CARD,
    overflow: "hidden",
  },
  dangerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginLeft: CONTENT_PADDING,
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
  // Left-aligned icon column shared with the section headings so a row icon
  // sits on the exact same x as the heading icon above it.
  rowIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
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

});
