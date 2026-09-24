import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { SCREEN_STYLES } from "@/theme/screen";
import { scale } from "@/theme/responsive";

const CONTENT_PADDING = THEME.SPACE.LG;

export const styles = StyleSheet.create({
  container: SCREEN_STYLES.container,
  content: SCREEN_STYLES.content,
  stepper: {
    flexDirection: "row",
    alignSelf: "center",
    gap: THEME.SPACE.SM,
    marginBottom: THEME.SPACE.LG,
  },
  stepDot: {
    width: scale(36),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: THEME.COLORS.SWITCH_OFF,
  },
  stepDotActive: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  // The method step leans on the header title; this line leads straight into
  // the provider list instead of repeating "Sign in" a second time.
  lead: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginBottom: THEME.SPACE.XL,
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
  },
  subtitle: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    lineHeight: THEME.LINE_HEIGHT.RELAXED,
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.XL,
  },
  methods: {
    gap: THEME.SPACE.SM,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: THEME.LAYOUT.ROW_MIN_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
    borderRadius: THEME.RADIUS.CARD,
    backgroundColor: THEME.COLORS.SURFACE,
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
    paddingRight: THEME.SPACE.MD,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.MD,
    marginVertical: THEME.SPACE.LG,
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
  hint: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
    lineHeight: scale(17),
    marginTop: THEME.SPACE.LG,
  },
  form: {
    marginTop: THEME.SPACE.SM,
  },
  submit: {
    height: scale(52),
    marginTop: THEME.SPACE.XXL,
    borderRadius: THEME.RADIUS.CARD,
    backgroundColor: THEME.COLORS.BRAND,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  submitText: {
    color: THEME.COLORS.TEXT_ON_LIGHT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  codeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: THEME.SPACE.MD,
    marginTop: THEME.SPACE.LG,
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
  error: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.LG,
    textAlign: "center",
  },
});
