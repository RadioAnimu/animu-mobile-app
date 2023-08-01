import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";
import Constans from "expo-constants";
import { Platform } from "expo-modules-core";

export const styles = StyleSheet.create({
    view: {
        flexDirection: "column",
        minHeight: 72,
    },
    container: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: THEME.COLORS.PRIMARY,
        width: Dimensions.get("window").width,
        height: 67,
    },
    playBtn: {
        width: 48,
        height: 48,
        objectFit: "contain",
        marginHorizontal: 47,
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
    progressBarView: {
        height: 5,
        margin: 0,
        padding: 0,
        backgroundColor: THEME.COLORS.SHAPE,
    },
});
