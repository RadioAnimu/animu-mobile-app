import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        backgroundColor: THEME.COLORS.SHAPE,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
        height: 27,
        width: 186,
        marginBottom: 10,
    },
    text: {
        color: THEME.COLORS.LISTENERS,
        fontSize: THEME.FONT_SIZE.MD,
        fontFamily: THEME.FONT_FAMILY.BOLD,
    },
    foninho: {
        width: 18,
        height: 18,
        objectFit: "contain",
    },
});
