export const THEME = {
  COLORS: {
    APP_BG: "#471654",
    BG_DEEP: "#160135",

    SURFACE: "#270052",
    BRAND: "#6BDB00",
    /** Brand at 15% — success badges and the selected select option. */
    BRAND_SUBTLE: "rgba(107, 219, 0, 0.15)",
    FRAME: "#42008C",
    LIVE: "#FF0000",

    TEXT: "#FFFFFF",
    TEXT_ON_LIGHT: "#000000",
    TEXT_SOFT: "rgba(255, 255, 255, 0.7)",
    TEXT_DIM: "rgba(255, 255, 255, 0.5)",
    SWITCH_OFF: "rgba(255, 255, 255, 0.25)",
    HAIRLINE: "rgba(255, 255, 255, 0.15)",
    /** Fainter hairline for switch tracks and outlines. */
    HAIRLINE_SOFT: "rgba(255, 255, 255, 0.1)",
    SURFACE_SUBTLE: "rgba(255, 255, 255, 0.08)",

    SCRIM: "rgba(0, 0, 0, 0.6)",

    ERROR: "#F87171",

    /** Oscilloscope stroke — preserved from the original visualizer. */
    VISUALIZER: "#723eb2",

    INPUT_BG: "#5100A3",
    INPUT_BORDER: "#220056",
    ROW_ACTIVE: "#5700B8",
    ROW_INACTIVE: "#24004D",
  },

  OPACITY: {
    DISABLED: 0.5,
    SOFT: 0.7,
  },

  FONT_FAMILY: {
    REGULAR: "proximanova-reg",
    BOLD: "proximanova-bold",
  },

  FONT_SIZE: {
    CAPTION: 12,
    LABEL: 13,
    BODY: 14,
    LIST: 16,
    SUBHEAD: 19,
    HEADING: 20,
    TITLE: 22,
  },

  LINE_HEIGHT: {
    BODY: 16,
    /** Body copy with a little more air (profile info, sheet subtitles). */
    RELAXED: 19,
    SUBHEAD: 20,
    HEADING: 27.5,
  },

  ICON: {
    MD: 22,
    LG: 24,
    XL: 40,
  },

  SPACE: {
    XXS: 2,
    XS: 4,
    SM: 8,
    MD: 12,
    LG: 16,
    XL: 20,
    XXL: 24,
    XXXL: 32,
  },

  RADIUS: {
    SM: 6,
    MD: 8,
    LG: 10,
    XL: 12,
    /** Grouped settings/profile card — the established surface radius. */
    CARD: 14,
    SHEET: 20,
    CIRCLE: 999,
  },

  LAYOUT: {
    /** Fixed leading-icon column shared by settings/profile rows. */
    ICON_BOX_WIDTH: 32,
    /** Minimum height of a settings/profile row. */
    ROW_MIN_HEIGHT: 64,
    /** Centered content column shared by the full-screen pages. */
    CONTENT_WIDTH: "88%" as const,
    CONTENT_MAX_WIDTH: 560,
  },
};
