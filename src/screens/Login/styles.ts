import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;
const BACK_BUTTON = THEME.LAYOUT.TOUCH_TARGET;
/** The Animu Connect step's hero badge around its XL glyph. */
const CONNECT_BADGE = scale(64);

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    ...SCREEN_STYLES.content,
    // The back arrow sits in its own bar above, so the page starts under it.
    paddingTop: THEME.SPACE.SM,
  },
  // Same inset as the ScreenHeader arrow on the other pages.
  topBar: {
    paddingHorizontal: THEME.SPACE.SM,
    paddingTop: THEME.SPACE.SM,
  },
  backButton: {
    width: BACK_BUTTON,
    height: BACK_BUTTON,
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
  tagline: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.BODY,
    textAlign: "center",
    marginTop: THEME.SPACE.MD,
  },
  // Providers are outlined pills: icon left, label centered (the empty right
  // slot balances the icon column), so they stay secondary to Animu Connect.
  methods: {
    gap: THEME.SPACE.SM,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    // A floor, so a label that wraps at large text grows the pill.
    minHeight: THEME.LAYOUT.CONTROL_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: THEME.SPACE.XS,
    borderRadius: THEME.RADIUS.CIRCLE,
    borderWidth: 1,
    borderColor: THEME.COLORS.SWITCH_OFF,
  },
  methodIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  methodLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
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
  // The code step has no button: the in-flight spinner shows the verify runs.
  busyRow: {
    alignItems: "center",
    marginTop: CONTENT_PADDING,
  },
  legal: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
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
  form: {
    marginTop: THEME.SPACE.XXL,
  },
  connectActions: {
    marginTop: CONTENT_PADDING,
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
  // The shared failure notice sits between the fields and the spinner.
  errorSlot: {
    marginVertical: CONTENT_PADDING,
  },
});
