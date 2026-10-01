import { StyleSheet } from "react-native";

import { THEME } from "@/theme";
import { scale } from "@/theme/responsive";

const FIELD_HEIGHT = scale(48);
const FIELD_ICON = scale(22);

export const styles = StyleSheet.create({
  fieldLabel: {
    color: THEME.COLORS.TEXT_SOFT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LABEL,
    marginBottom: THEME.SPACE.SM,
    marginTop: THEME.SPACE.MD,
  },
  // The app's field recipe (MakeRequest search, AccountEmails form): INPUT_BG
  // with the deeper INPUT_BORDER, MD radius; focus only shifts the border hue.
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: THEME.SPACE.SM,
    height: FIELD_HEIGHT,
    paddingHorizontal: THEME.SPACE.LG,
    borderRadius: THEME.RADIUS.MD,
    backgroundColor: THEME.COLORS.INPUT_BG,
    borderWidth: 1,
    borderColor: THEME.COLORS.INPUT_BORDER,
  },
  fieldFocused: {
    borderColor: THEME.COLORS.BRAND,
  },
  submit: {
    marginTop: THEME.SPACE.LG,
  },
  input: {
    flex: 1,
    padding: 0,
    color: THEME.COLORS.TEXT,
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: THEME.FONT_SIZE.LIST,
  },
  // Same trailing clear slot as the request search field.
  fieldIcon: {
    width: FIELD_ICON,
    height: FIELD_ICON,
    borderRadius: THEME.RADIUS.CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
});
