import { Dimensions, StyleSheet } from "react-native";
import { THEME } from "../../theme";
import Constans from "expo-constants";
import { Platform } from "expo-modules-core";

export const styles = StyleSheet.create({
    view: {
        flexDirection: "column",
        alignItems: "center",
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
        width: Dimensions.get("window").width,
        margin: 0,
        padding: 0,
    },
    progressBar: {
        margin: 0,
        padding: 0,
        height: 0,
        fontSize: 0,
        transform: [{ scaleX: 1.0 }, { scaleY: 2.0 }],
        width: Dimensions.get("window").width,
        marginHorizontal: Platform.select({ ios: 0, android: -15 }),
    },
});
