import { StyleSheet } from "react-native";

import { THEME } from "../../theme";

const HEADER_HEIGHT = 72;
const HEADER_BUTTON = 44;
const CARD_RADIUS = 14;
const ICON_BOX_WIDTH = 40;

export { HEADER_HEIGHT };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BG_DEEP,
  },
  header: {
    width: "100%",
    backgroundColor: THEME.COLORS.SURFACE,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  headerButton: {
    width: HEADER_BUTTON,
    height: HEADER_BUTTON,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.TITLE,
  },
  content: {
    flexGrow: 1,
    width: "85%",
    alignSelf: "center",
    paddingBottom: THEME.SPACE.XXXL,
  },
  stepper: {
    flexDirection: "row",
    alignSelf: "center",
    gap: THEME.SPACE.SM,
    marginTop: THEME.SPACE.XL,
    marginBottom: THEME.SPACE.LG,
  },
  stepDot: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.COLORS.SWITCH_OFF,
  },
  stepDotActive: {
    backgroundColor: THEME.COLORS.BRAND,
  },
  title: {
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.HEADING,
    marginTop: THEME.SPACE.MD,
  },
  subtitle: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.XS,
    marginBottom: THEME.SPACE.XL,
  },
  methods: {
    gap: THEME.SPACE.SM,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: CARD_RADIUS,
    backgroundColor: THEME.COLORS.SURFACE,
  },
  methodDisabled: {
    opacity: THEME.OPACITY.DISABLED,
  },
  methodIcon: {
    width: ICON_BOX_WIDTH,
    alignItems: "flex-start",
  },
  methodLabel: {
    flex: 1,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  soon: {
    color: THEME.COLORS.TEXT_DIM,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.CAPTION,
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
    marginTop: THEME.SPACE.MD,
    lineHeight: 17,
  },
  form: {
    marginTop: THEME.SPACE.SM,
  },
  fieldLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    marginBottom: THEME.SPACE.XS,
    marginTop: THEME.SPACE.MD,
  },
  input: {
    height: 48,
    paddingHorizontal: THEME.SPACE.MD,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  submit: {
    height: 52,
    marginTop: THEME.SPACE.XXL,
    borderRadius: CARD_RADIUS,
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
  error: {
    color: THEME.COLORS.ERROR,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.BODY,
    marginTop: THEME.SPACE.LG,
    textAlign: "center",
  },
});
