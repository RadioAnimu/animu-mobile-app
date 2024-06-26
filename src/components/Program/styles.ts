import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 9,
    },
    title: {
        fontSize: THEME.FONT_SIZE.PROGRAM_LABELS,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
    label: {
        color: THEME.COLORS.WHITE_TEXT,
        fontSize: THEME.FONT_SIZE.PROGRAM_LABELS,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
    green: {
        color: THEME.COLORS.SHAPE,
    }
});
