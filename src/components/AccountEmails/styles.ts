import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

/**
 * Inline Animu Connect list: full-bleed rows inside the group card that share
 * the Settings row rhythm (icon column, min height) with the section heading
 * and the Linked Accounts rows above, so the page keeps one vertical grid.
 */
export const styles = StyleSheet.create({
  hint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.SM,
  },
  loading: {
    marginVertical: THEME.SPACE.LG,
  },
  empty: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.MD,
  },
  // Same row as Linked Accounts, but the address replaces the label line.
  emailRow: ROW_STYLES.row,
  // Same left-aligned icon column as the section heading and provider rows.
  emailIcon: ROW_STYLES.iconBox,
  /** Collapse an icon font's extra leading so it centers on the row. */
  iconGlyph: {
    lineHeight: THEME.ICON.MD,
  },
  emailBody: {
    flex: 1,
    // Same shrink contract as the other rows — a long address ellipsizes
    // before it can push the provider marks out.
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: THEME.SPACE.MD,
  },
  emailValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  emailTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    marginLeft: THEME.SPACE.XS,
  },
  badge: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: scale(1),
    borderRadius: THEME.RADIUS.SM,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    overflow: "hidden",
  },
  /**
   * Provider marks sharing the leading icon column: one chip per corner of
   * the 32pt square (diagonal first), each ringed in the surface color so
   * neighboring brands stay visually separate.
   */
  markGrid: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    height: THEME.LAYOUT.ICON_BOX_WIDTH,
  },
  markChip: {
    position: "absolute",
    width: scale(20),
    height: scale(20),
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: scale(2),
    borderColor: THEME.COLORS.SURFACE,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    alignItems: "center",
    justifyContent: "center",
  },
  markTopRight: {
    top: 0,
    right: 0,
  },
  markBottomLeft: {
    bottom: 0,
    left: 0,
  },
  markTopLeft: {
    top: 0,
    left: 0,
  },
  markBottomRight: {
    bottom: 0,
    right: 0,
  },
  markOverflow: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  removeButton: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
  },
  divider: ROW_STYLES.divider,
  // Solid, like every other button in the app (secondary fill = INPUT_BG).
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    minHeight: scale(44),
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    marginHorizontal: CONTENT_PADDING,
    marginTop: THEME.SPACE.MD,
    marginBottom: THEME.SPACE.MD,
  },
  addText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  form: {
    gap: THEME.SPACE.XS,
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: THEME.SPACE.MD,
  },
  formActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.SM,
  },
  cancelButton: {
    minHeight: scale(44),
    paddingHorizontal: THEME.SPACE.LG,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  submit: {
    flex: 1,
    minHeight: scale(44),
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  error: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    paddingHorizontal: CONTENT_PADDING,
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
