import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

export const styles = StyleSheet.create({
  replyForm: { gap: THEME.SPACE.MD },
  scrollContent: {
    gap: THEME.SPACE.MD,
    paddingHorizontal: THEME.SPACE.LG,
    paddingTop: THEME.SPACE.SM,
  },
});
