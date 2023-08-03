import { Dimensions, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        width: Dimensions.get("window").width,
        height: 127,
        position: 'absolute',
        top: 0,
        justifyContent: "center",
    },
    webViewContainer: {
        width: "100%",
        height: 75
    },
});
