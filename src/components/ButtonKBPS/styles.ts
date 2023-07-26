import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: 45,
        width: 95,
        borderRadius: 4,
        padding: 2,
    },
    kbps: {
        fontSize: THEME.FONT_SIZE.BITRATE_LABEL,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
    category: {
        fontSize: THEME.FONT_SIZE.BITRATE_BTNS,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    }
});

