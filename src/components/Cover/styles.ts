import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  image: {
    resizeMode: "cover",
    width: 240,
    height: 240,
    borderRadius: 12,
    borderColor: THEME.COLORS.COVER,
    marginBottom: 11,
    borderWidth: 5,
  },
});
