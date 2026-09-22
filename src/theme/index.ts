import { scale } from "@/theme/responsive";

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
    /** Error at 12% / 40% — destructive buttons that read without shouting. */
    ERROR_SUBTLE: "rgba(248, 113, 113, 0.12)",
    ERROR_BORDER: "rgba(248, 113, 113, 0.4)",

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

  // Sizes are authored at the 393pt reference and scaled per device.
  FONT_SIZE: {
    CAPTION: scale(12),
    LABEL: scale(13),
    BODY: scale(14),
    LIST: scale(16),
    SUBHEAD: scale(19),
    HEADING: scale(20),
    TITLE: scale(22),
  },

  LINE_HEIGHT: {
    BODY: scale(16),
    /** Body copy with a little more air (profile info, sheet subtitles). */
    RELAXED: scale(19),
    SUBHEAD: scale(20),
    HEADING: scale(27.5),
  },

  ICON: {
    MD: scale(22),
    LG: scale(24),
    XL: scale(40),
  },

  SPACE: {
    XXS: scale(2),
    XS: scale(4),
    SM: scale(8),
    MD: scale(12),
    LG: scale(16),
    XL: scale(20),
    XXL: scale(24),
    XXXL: scale(32),
  },

  RADIUS: {
    SM: scale(6),
    MD: scale(8),
    LG: scale(10),
    XL: scale(12),
    /** Grouped settings/profile card — the established surface radius. */
    CARD: scale(14),
    SHEET: scale(20),
    CIRCLE: 999,
  },

  LAYOUT: {
    /** Fixed leading-icon column shared by settings/profile rows. */
    ICON_BOX_WIDTH: scale(32),
    /** Minimum height of a settings/profile row. */
    ROW_MIN_HEIGHT: scale(64),
    /** Centered content column shared by the full-screen pages. */
    CONTENT_WIDTH: "88%" as const,
    CONTENT_MAX_WIDTH: scale(560),
  },
};
