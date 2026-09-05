import { Dimensions, StyleSheet } from "react-native";

import { THEME } from "../../theme";

export const SWITCH = {
  TRACK_WIDTH: 48,
  TRACK_HEIGHT: 28,
  THUMB: 22,
  PADDING: 3,
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.BACKGROUND_900,
  },
  header: {
    height: 72,
    width: Dimensions.get("window").width,
    backgroundColor: THEME.COLORS.PRIMARY,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LG,
  },
  appContainer: {
    flexDirection: "column",
    width: "85%",
    paddingBottom: 15,
    alignSelf: "center",
  },
  titleSection: {
    marginTop: 24,
    marginBottom: 12,
  },
  titleText: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: THEME.FONT_SIZE.LG,
  },
  splitter: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginTop: 24,
  },
  card: {
    backgroundColor: THEME.COLORS.COVER,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profile: {
    flex: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: 16,
    paddingRight: 12,
  },
  rowsGroup: {
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  switchTrack: {
    width: SWITCH.TRACK_WIDTH,
    height: SWITCH.TRACK_HEIGHT,
    borderRadius: SWITCH.TRACK_HEIGHT / 2,
    justifyContent: "center",
  },
  switchThumb: {
    width: SWITCH.THUMB,
    height: SWITCH.THUMB,
    borderRadius: SWITCH.THUMB / 2,
    backgroundColor: THEME.COLORS.WHITE_TEXT,
    position: "absolute",
    left: SWITCH.PADDING,
  },
  sectionLabel: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
    fontSize: 16,
    marginTop: 12,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    marginTop: 10,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "rgba(107, 219, 0, 0.15)",
  },
  segmentText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: 16,
  },
  segmentTextActive: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  langPill: {
    flexGrow: 1,
    flexBasis: "46%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  langPillActive: {
    backgroundColor: "rgba(107, 219, 0, 0.15)",
  },
  langPillText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: THEME.FONT_FAMILY.REGULAR,
    fontSize: 16,
  },
  langPillTextActive: {
    color: THEME.COLORS.WHITE_TEXT,
    fontFamily: THEME.FONT_FAMILY.BOLD,
  },
});
