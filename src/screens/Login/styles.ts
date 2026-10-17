import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";
import { CONTINUOUS } from "@/theme/shape";

const CONTENT_PADDING = THEME.SPACE.LG;
const BACK_BUTTON = THEME.LAYOUT.TOUCH_TARGET;
/**
 * The method step's wordmark. Smaller than the secondary screens' logo so the
 * headline, four providers, the notice and Animu Connect all fit above the
 * fold; the wordmark is the least informative thing on the screen.
 */
export const HERO_LOGO_HEIGHT = scale(96);
/** The Animu Connect step's header badge around its LG glyph. */
const CONNECT_BADGE = scale(48);

/** Small supporting copy under a control or form (tagline, code validity). */
const caption = {
  color: THEME.COLORS.TEXT_DIM,
  fontFamily: THEME.FONT_FAMILY.REGULAR,
  fontSize: THEME.FONT_SIZE.CAPTION,
  lineHeight: THEME.LINE_HEIGHT.CAPTION,
  textAlign: "center",
} as const;

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    ...SCREEN_STYLES.content,
    // The back arrow sits in its own bar above, so the page starts a gap
    // under it — on the connect step the header begins right here.
    paddingTop: THEME.SPACE.MD,
    // The safe area already clears the home indicator; the scaffold's larger
    // inset would only push the terms line (and the fold) further down.
    paddingBottom: CONTENT_PADDING,
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
  // ── Shared header copy ──
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
    textAlign: "center",
    marginTop: THEME.SPACE.MD,
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
  caption: {
    ...caption,
    marginTop: THEME.SPACE.MD,
  },
  buttonDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  // The Stats screen's bordered notice: it explains a rule without becoming a
  // card, so it stays transparent over the artwork.
  notice: {
    alignItems: "flex-start",
    borderColor: THEME.COLORS.HAIRLINE_SOFT,
    borderRadius: THEME.RADIUS.CARD,
    ...CONTINUOUS,
    borderWidth: 1,
    flexDirection: "row",
    gap: THEME.SPACE.SM,
    padding: THEME.SPACE.MD,
  },
  noticeText: {
    color: THEME.COLORS.TEXT_SOFT,
    flex: 1,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LABEL,
    lineHeight: THEME.LINE_HEIGHT.CAPTION,
  },
  // ── Method step ──
  hero: {
    alignItems: "center",
    marginTop: THEME.SPACE.LG,
  },
  providers: {
    marginTop: THEME.SPACE.XL,
  },
  // Providers are outlined pills: icon left, label centered (the empty right
  // slot balances the icon column). They are all the same size on purpose —
  // the App Store wants Apple's button no smaller than the others.
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
  // Discord is the one provider song requests need, so it alone is outlined in
  // the brand hue (no fill: the single filled button rule stays intact).
  methodEmphasis: {
    borderColor: THEME.COLORS.BRAND,
  },
  methodIcon: {
    width: THEME.LAYOUT.ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  methodText: {
    flex: 1,
  },
  methodLabel: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
    textAlign: "center",
  },
  methodPerk: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    textAlign: "center",
  },
  noticeSlot: {
    marginTop: THEME.SPACE.MD,
  },
  noticeAboveField: {
    marginBottom: CONTENT_PADDING,
  },
  // Grows to the page's bottom edge so the terms line can pin itself there.
  footerBlock: {
    flexGrow: 1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    marginVertical: THEME.SPACE.MD,
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
    ...caption,
    marginTop: "auto",
    paddingTop: CONTENT_PADDING,
    paddingHorizontal: THEME.SPACE.MD,
  },
  legalLink: {
    color: THEME.COLORS.BRAND,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  // ── Animu Connect step ──
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
  form: {
    marginTop: THEME.SPACE.XL,
  },
  connectActions: {
    marginTop: CONTENT_PADDING,
  },
  // Text-only link: vertical padding plus a floor keep the tap area at 44pt
  // even with a one-line label at the smallest text size.
  link: {
    alignSelf: "center",
    justifyContent: "center",
    minHeight: THEME.LAYOUT.TOUCH_TARGET,
    paddingVertical: THEME.SPACE.MD,
  },
  linkText: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.BODY,
    textAlign: "center",
  },
  // The shared failure notice sits between the fields and the spinner (or,
  // on the method step, right above the providers).
  errorSlot: {
    marginVertical: CONTENT_PADDING,
  },
});
