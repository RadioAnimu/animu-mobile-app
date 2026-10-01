import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { ROW_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

/**
 * Inline Animu Connect list: full-bleed rows inside the group card that share
 * the Settings row rhythm (icon column, min height) with the section heading
 * and the Linked Accounts rows above, so the page keeps one vertical grid.
 * The add form closes the card in place of the old "add" row.
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
  removeButton: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
    marginLeft: THEME.SPACE.XS,
  },
  divider: ROW_STYLES.divider,
  disabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  // ── Inline add form (the last block of the card) ──
  form: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: THEME.SPACE.MD,
    paddingBottom: THEME.SPACE.LG,
  },
  // The explanatory line above the field: how many extra addresses the server
  // accepts, or where the code went on the code step.
  formHint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
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
});
