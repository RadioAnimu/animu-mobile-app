import { StyleSheet } from "react-native";
import { THEME } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: THEME.COLORS.OVERLAY,
  },
  backdrop: {
    flex: 1,
  },
  content: {
    width: "100%",
    backgroundColor: THEME.COLORS.PRIMARY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  closeArea: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    height: 35,
    alignItems: "center",
  },
  dragIcon: {
    height: 14,
    resizeMode: "contain",
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  img: {
    height: 140,
    width: "100%",
    borderRadius: 8,
  },
  programName: {
    color: THEME.COLORS.SHAPE,
    fontSize: THEME.FONT_SIZE.MD,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    textAlign: "center",
  },
  informationBlock: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
    paddingBottom: 4,
  },
  label: {
    color: THEME.COLORS.WHITE_TEXT,
    fontSize: THEME.FONT_SIZE.INFO_PROGRAM,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
