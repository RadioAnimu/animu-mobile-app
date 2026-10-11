import { StyleSheet } from "react-native";
import { THEME } from "@/theme";

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: THEME.SPACE.LG,
    maxWidth: THEME.LAYOUT.COMPACT_WIDTH,
  },
});
