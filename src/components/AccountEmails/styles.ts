import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";

const CONTENT_PADDING = THEME.SPACE.LG;

/**
 * Inline Animu Connect list: full-bleed rows inside the group card that share
 * the Settings row rhythm (icon column, min height) with the section heading
 * and the Linked Accounts rows above, so the page keeps one vertical grid.
 * Below them sit the card's footnotes and the "add extra email" row, which
 * opens the add form in place when tapped.
 */
export const styles = StyleSheet.create({
  loading: {
    marginVertical: THEME.SPACE.LG,
  },
  empty: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.XL,
  },
  // Same row as Linked Accounts, but the address is the label line and the
  // provenance caption (marks + names) is the identity line under it.
  emailRow: ROW_STYLES.row,
  emailBody: {
    flex: 1,
    // Same shrink contract as the other rows — a long address ellipsizes
    // before it can push the delete action out.
    minWidth: 0,
    justifyContent: "center",
    gap: THEME.SPACE.XS,
    paddingVertical: THEME.SPACE.MD,
  },
  emailValue: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  // Each source reads as "mark name", the pairs separated by a middle dot,
  // so several providers stay on one caption line under the address.
  emailSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: THEME.SPACE.SM,
    rowGap: THEME.SPACE.XS,
    minWidth: 0,
  },
  emailSource: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  emailSourceSeparator: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  // The Apple relay warning under the address: small, dim, and led by the
  // same info glyph the rest of the app uses for "here's a rule".
  relay: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.XS,
    minWidth: 0,
  },
  relayText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    // The caption may wrap at large text sizes; let it, without pushing the
    // row's trailing delete out.
    flexShrink: 1,
  },
  removeButton: {
    width: THEME.LAYOUT.ICON_BUTTON,
    height: THEME.LAYOUT.ICON_BUTTON,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: THEME.SPACE.XS,
  },
  divider: ROW_STYLES.divider,
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  // The card's closing rules (why a provider address has no delete, why only
  // one extra is allowed): the same inset the rows use, so they read as part
  // of the card rather than as a stray caption under it.
  footnote: {
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.MD,
    gap: THEME.SPACE.SM,
  },
  footnoteText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
  },
  // ── Inline add form (revealed by the add row) ──
  form: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.LG,
  },
  // The explanatory line above the field: how many extra addresses the server
  // accepts. The same on both steps.
  formHint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
  },
  formStep: {
    marginTop: THEME.SPACE.MD,
  },
  // The code step's expiry note, in Login's caption recipe (dim, small) so
  // both Animu Connect forms describe the code the same way.
  formValidity: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
    marginTop: THEME.SPACE.MD,
  },
  formError: {
    marginTop: THEME.SPACE.MD,
  },
  formBusy: {
    alignItems: "center",
    marginTop: THEME.SPACE.MD,
  },
  formActions: {
    marginTop: THEME.SPACE.MD,
  },
  // Text-only way out of the form, Login's "New here?" link: vertical padding
  // plus a floor keep the tap area at 44pt even at the smallest text size.
  cancel: {
    alignSelf: "center",
    justifyContent: "center",
    minHeight: THEME.LAYOUT.TOUCH_TARGET,
    paddingVertical: THEME.SPACE.MD,
  },
  cancelText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
});
