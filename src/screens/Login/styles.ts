import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;
const BACK_BUTTON = scale(44);
const CONNECT_BADGE = scale(64);

/** Shared geometry of the sign-in option rows (providers and Animu Connect). */
const OPTION_ROW = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
  paddingHorizontal: CONTENT_PADDING,
  borderRadius: THEME.RADIUS.CARD,
};
const OPTION_LABEL = {
  flex: 1,
  fontFamily: THEME.FONT_FAMILY.BOLD,
  fontSize: THEME.FONT_SIZE.LIST,
  paddingRight: THEME.SPACE.MD,
};

export const styles = StyleSheet.create({
  // The app artwork stays visible behind the flow; AuthBackdrop draws the
  // gradient scrim and the brand glow on top of it.
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    ...SCREEN_STYLES.content,
    // The floating back arrow (not a SURFACE header bar) rides the artwork,
    // so the page starts right under the status bar.
    paddingTop: THEME.SPACE.SM,
  },
  backButton: {
    width: BACK_BUTTON,
    height: BACK_BUTTON,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Method step ──
  hero: {
    alignItems: "center",
    marginTop: THEME.SPACE.XXL,
  },
  headline: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
    marginTop: THEME.SPACE.LG,
  },
  subtitle: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    textAlign: "center",
    marginTop: THEME.SPACE.XS,
    paddingHorizontal: THEME.SPACE.MD,
  },
  actions: {
    marginTop: THEME.SPACE.XXL,
  },
  buttonDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  // Provider options use the same row recipe as Settings/Account: a SURFACE
  // card, the shared 64pt row rhythm and the 32pt leading icon column.
  methods: {
    gap: THEME.SPACE.SM,
  },
  method: {
    ...OPTION_ROW,
    backgroundColor: THEME.COLORS.SURFACE,
  },
  methodIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  methodLabel: {
    ...OPTION_LABEL,
    color: THEME.COLORS.TEXT,
  },
  // Animu Connect closes the list as the last option, in the brand fill but
  // on the same row/icon grid as the providers, carrying the Account screen's
  // own mark for it (`alternate-email`).
  connectOption: {
    ...OPTION_ROW,
    backgroundColor: THEME.COLORS.BRAND,
  },
  connectOptionLabel: {
    ...OPTION_LABEL,
    color: THEME.COLORS.TEXT_ON_LIGHT,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    marginVertical: CONTENT_PADDING,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: THEME.COLORS.HAIRLINE,
  },
  dividerText: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
  },
  // Where the submit button would sit: the in-flight spinner keeps the
  // keyboard-driven flow honest while the request runs.
  busyRow: {
    alignItems: "center",
    marginTop: CONTENT_PADDING,
  },
  legal: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: scale(18),
    textAlign: "center",
    marginTop: "auto",
    paddingTop: THEME.SPACE.XXXL,
    paddingHorizontal: THEME.SPACE.MD,
  },
  legalLink: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  // ── Animu Connect step ──
  // Centered as one block under the back arrow: header, fields, action and
  // links stay together instead of stranding a card at the bottom.
  connectBody: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: THEME.SPACE.XXXL,
    paddingBottom: THEME.SPACE.XXXL,
  },
  connectHeader: {
    alignItems: "center",
  },
  connectBadge: {
    width: CONNECT_BADGE,
    height: CONNECT_BADGE,
    borderRadius: THEME.RADIUS.CIRCLE,
    backgroundColor: THEME.COLORS.BRAND_SUBTLE,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
    marginTop: THEME.SPACE.LG,
  },
  // The address the code went to, emphasized inside the sentence.
  subtitleEmail: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  form: {
    marginTop: THEME.SPACE.XXL,
  },
  codeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.MD,
    marginTop: CONTENT_PADDING,
  },
  link: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  linkDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  linkDot: {
    color: THEME.COLORS.TEXT_DIM,
    fontSize: THEME.FONT_SIZE.BODY,
  },
  hint: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    textAlign: "center",
    marginTop: CONTENT_PADDING,
    paddingHorizontal: THEME.SPACE.MD,
  },
  // Same inline failure treatment as the request submit sheet: the error hue
  // on the icon and the message, no colored card around it.
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.SM,
    marginVertical: CONTENT_PADDING,
  },
  errorText: {
    flexShrink: 1,
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    textAlign: "center",
  },
});
