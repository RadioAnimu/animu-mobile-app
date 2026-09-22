import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

/**
 * Inline expansion shares the Settings row rhythm: the closed state is a
 * normal 64px row, the unfolded panel is a tonal card inset in the group.
 */
export const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
  },
  // Left-aligned icon column matching the section heading and Account rows.
  triggerIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  /** Collapse an icon font's extra leading so it centers on the row. */
  iconGlyph: {
    lineHeight: THEME.ICON.MD,
  },
  triggerBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
    paddingRight: CONTENT_PADDING,
  },
  triggerLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  triggerCaption: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  panel: {
    marginHorizontal: THEME.SPACE.MD,
    marginBottom: THEME.SPACE.MD,
    padding: THEME.SPACE.MD,
    gap: THEME.SPACE.SM,
    backgroundColor: THEME.COLORS.SURFACE_SUBTLE,
    borderRadius: THEME.RADIUS.LG,
  },
  hint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
  },
  loading: {
    marginVertical: THEME.SPACE.MD,
  },
  empty: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    paddingVertical: THEME.SPACE.SM,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: THEME.SPACE.SM,
  },
  // Same left-aligned icon column as the trigger and the provider marks.
  emailIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  // flex 1 so the address eats the free space and the marks stay flush right.
  emailValue: {
    flex: 1,
    minWidth: 0,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  emailTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  badge: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
    paddingHorizontal: THEME.SPACE.SM,
    paddingVertical: scale(1),
    borderRadius: THEME.RADIUS.SM,
    backgroundColor: THEME.COLORS.SURFACE,
    overflow: "hidden",
  },
  /** Provider brand marks for an address (one per provider). */
  providerMarks: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
  },
  providerMark: {
    width: scale(20),
    height: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },
  providerOverflow: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  removeButton: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
  },
  // Solid, like every other button in the app (secondary fill = INPUT_BG).
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    minHeight: scale(44),
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
  },
  addText: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  form: {
    gap: THEME.SPACE.XS,
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
  },
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
});
