import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES, ROW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";
import { CONTINUOUS, avatarRadius, concentric } from "@/theme/shape";

// 2015-Twitter header: a wide cover with a rounded-square avatar hanging off
// its bottom-left.
const BANNER_HEIGHT = scale(104);
const AVATAR = THEME.LAYOUT.AVATAR.LG;
const AVATAR_RADIUS = avatarRadius(AVATAR);
const AVATAR_BORDER = scale(4);
const BADGE_SIZE = scale(20);
const NAME_LINE = scale(28);
// Shared content inset + row rhythm with Settings.
const CONTENT_PADDING = THEME.SPACE.LG;

export { AVATAR, BADGE_SIZE };

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
  signedOutAction: {
    alignSelf: "stretch",
  },
  card: {
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
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
  // Avatar overlaps the cover's bottom-left edge; the identity block sits
  // under it, left-aligned with the avatar, like the classic header.
  headerRow: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: CONTENT_PADDING,
  },
  avatarWrap: {
    alignSelf: "flex-start",
    marginTop: -AVATAR * 0.5,
    borderRadius: concentric(AVATAR_RADIUS, AVATAR_BORDER),
    ...CONTINUOUS,
    borderWidth: AVATAR_BORDER,
    borderColor: THEME.COLORS.SURFACE,
    backgroundColor: THEME.COLORS.APP_BG,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR_RADIUS,
    ...CONTINUOUS,
  },
  // Name and @handle sit beside the avatar, in the strip under the cover.
  identityRow: {
    flexDirection: "row",
    gap: THEME.SPACE.MD,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    paddingTop: THEME.SPACE.SM,
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
    fontSize: THEME.FONT_SIZE.TITLE,
    lineHeight: NAME_LINE,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  // Same height as the name line so the glyph centers on it exactly.
  badge: {
    height: NAME_LINE,
    justifyContent: "center",
  },
  handle: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  caption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  verifiedInfo: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
  },
  // Twitter-style meta lines under the handle: one fixed icon column so the
  // text of every line starts on the same left edge.
  meta: {
    marginTop: THEME.SPACE.LG,
    gap: THEME.SPACE.SM,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  metaIcon: {
    width: THEME.ICON.MD,
    alignItems: "center",
  },
  metaText: {
    flexShrink: 1,
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  metaStrong: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  // Plain explanation between a section heading and its card, on the same
  // left edge as the heading's icon.
  sectionHint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    marginBottom: THEME.SPACE.MD,
  },
  group: SCREEN_STYLES.group,
  groupSpaced: {
    ...SCREEN_STYLES.group,
    marginTop: THEME.SPACE.XXL,
  },
  // Same row rhythm as Settings and Select (see `ROW_STYLES`).
  row: ROW_STYLES.row,
  rowCaption: ROW_STYLES.caption,
  // Explains a control that is disabled (the last linked sign-in method).
  footnote: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.SM,
  },
  // Icon-only link/unlink affordance: a fixed ICON_BUTTON square keeps the tap
  // target generous while freeing the horizontal budget a text action used
  // to eat at small widths (the rowCaption's whole wrapping problem).
  rowIconAction: {
    width: THEME.LAYOUT.ICON_BUTTON,
    height: THEME.LAYOUT.ICON_BUTTON,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: THEME.SPACE.XS,
  },
  rowActionBusy: {
    width: THEME.LAYOUT.ICON_BUTTON,
    marginLeft: THEME.SPACE.XS,
  },
  rowActionDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
