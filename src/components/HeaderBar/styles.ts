import { StyleSheet } from "react-native";
import { THEME } from "../../theme";
import Constans from "expo-constants";

export const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: THEME.COLORS.PRIMARY,
        width: "100%",
        maxHeight: 67 + Constans.statusBarHeight,
        paddingTop: Constans.statusBarHeight,
    },
    playBtn: {
        width: 55,
        objectFit: "contain",
    },
    menuBtn: {
        width: 27,
        height: 27,
        objectFit: "contain",
    },
    noteIcon: {
        width: 27,
        height: 27,
        objectFit: "contain",
    },
});
