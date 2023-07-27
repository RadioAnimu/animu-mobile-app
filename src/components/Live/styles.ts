import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
    track: {
        flexDirection: "row",
        width: Dimensions.get("window").width,
        backgroundColor: "#270052",
    },
    info: {
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
        paddingLeft: 14,
        gap: 2,
    },
    title: {
        color: THEME.COLORS.SHAPE,
        fontSize: THEME.FONT_SIZE.LG,
        fontFamily: THEME.FONT_FAMILY.BOLD,
        textAlign: "left",
    },
    song: {
        color: THEME.COLORS.WHITE_TEXT,
        fontSize: THEME.FONT_SIZE.MD,
        fontFamily: THEME.FONT_FAMILY.REGULAR,
    },
    artist: {
        color: THEME.COLORS.WHITE_TEXT,
        fontSize: THEME.FONT_SIZE.MD,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
});
