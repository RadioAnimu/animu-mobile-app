import { StyleSheet } from "react-native";
import { THEME } from "../../theme";
import Constans from "expo-constants";

export const styles = StyleSheet.create({
    image: {
        resizeMode: "cover",
        width: 240,
        height: 240,
        borderRadius: 12,
        borderColor: THEME.COLORS.COVER,
        borderWidth: 5,
    }
});
