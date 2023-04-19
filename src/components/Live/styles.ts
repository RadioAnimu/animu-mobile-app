import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
    track: {
        flexDirection: "column",
        justifyContent: "center",
        padding: 10,
        backgroundColor: "#270052",
        overflow: "hidden",
        minWidth: Dimensions.get("window").width,
    },
    title: {
        color: THEME.COLORS.SHAPE,
        fontSize: THEME.FONT_SIZE.LG,
        fontFamily: THEME.FONT_FAMILY.BOLD,
        textAlign: "left",
        height: THEME.FONT_SIZE.LG * 1.5,
    },
    album: {
        color: THEME.COLORS.WHITE_TEXT,
        fontSize: THEME.FONT_SIZE.MD,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
    artist: {
        color: THEME.COLORS.WHITE_TEXT,
        fontSize: THEME.FONT_SIZE.MD,
        fontFamily: THEME.FONT_FAMILY.REGULAR,
    },
});
