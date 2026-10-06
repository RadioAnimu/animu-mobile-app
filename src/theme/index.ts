import { CONTENT_MAX_WIDTH, scale } from "@/theme/responsive";

export const THEME = {
  COLORS: {
    APP_BG: "#471654",
    BG_DEEP: "#160135",

    SURFACE: "#270052",
    BRAND: "#6BDB00",
    /** Underside of the brand button — the hard drop shadow. */
    BRAND_DEEP: "#3C7A00",
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
    /** Neutral inline spinner on surfaces (filled buttons tint their own). */
    SPINNER: "rgba(255, 255, 255, 0.7)",

    ERROR: "#F87171",
    SUCCESS: "#6BDB00",
    WARNING: "#FBBF24",
    INFO: "#FFFFFF",
    PLACEHOLDER_ON_LIGHT: "#737373",
    SHADOW: "rgba(0, 0, 0, 0.35)",
    AUTH_VIGNETTE: "#0B001A",
    AUTH_VIGNETTE_SOFT: "#15002F",
    CHART_LEVELS: ["rgba(255, 255, 255, 0.06)", "rgba(107, 219, 0, 0.25)", "rgba(107, 219, 0, 0.45)", "rgba(107, 219, 0, 0.7)", "#6BDB00"],
    CACHE_REQUESTED: "#C77DFF",
    CACHE_PLAYED: "#4FC3F7",
    CACHE_SEARCH: "#FFCF56",
    CHART_BAR: "rgba(107, 219, 0, 0.35)",
    /**
     * Solid fill for destructive buttons. Derived from the error hue but
     * shifted slightly cool toward the app's violet surfaces (hue 352°) and
     * set at 75% saturation / 43% lightness, which lands on ~6.1:1 contrast
     * with white text (WCAG AA, near AAA) while staying high-chroma so it
     * reads as a deliberate red rather than a muddy brown.
     */
    DANGER: "#C01B31",

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
    /** `activeOpacity` of every TouchableOpacity — one pressed state app-wide. */
    PRESSED: 0.7,
    HIDDEN_INPUT: 0.01,
  },

  FONT_FAMILY: {
    REGULAR: "proximanova-reg",
    BOLD: "proximanova-bold",
  },

  /**
   * Caps on the OS text-size multiplier. Body copy, sheets and forms scale
   * freely; fixed-format chrome — the player's
   * sticker strips and chips, bars of a set height, bitrate pills — stops at
   * the largest non-accessibility size so a 300% setting can't burst it.
   */
  FONT_SCALE: {
    CHROME: 1.35,
    /**
     * Rows, menu items and headings: still double size, but short labels
     * in the narrow drawer and row columns keep whole words instead of
     * breaking mid-word at the extreme accessibility sizes.
     */
    CONTENT: 2,
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

  /** Tracking of the uppercase section headings (drawer + settings pages). */
  LETTER_SPACING: {
    CAPS: scale(1.2),
  },

  ICON: {
    /** Inline glyphs inside text runs: toasts, field errors, email sources. */
    SM: scale(16),
    /** Section-heading glyphs (one step under the row icons they head). */
    SECTION: scale(18),
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

  /**
   * Invisible tap-area extension (pt) for compact icon controls, so a 22pt
   * glyph still gets a ~44pt target without bloating the layout.
   */
  HIT_SLOP: {
    SM: 8,
    MD: 12,
  },

  /** Stacking order for in-tree overlays (native Modals sit above all). */
  Z_INDEX: {
    /** Pinned headers above the scroll content they float over. */
    HEADER: 2,
    /** App-level toast host above every screen. */
    TOAST: 100,
  },

  /** Chunky outlines of the sticker-style request sheets. */
  BORDER_WIDTH: {
    OUTLINE: 1,
    THIN: scale(2),
    THICK: scale(3),
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
    /** Android's 48dp minimum also clears iOS's 44pt recommendation. */
    TOUCH_TARGET: 48,
    BUTTON_HEIGHT: scale(48),
    SHEET_HANDLE_HEIGHT: 48,
    SHEET_MAX_HEIGHT: "90%" as const,
    CODE_BOX: scale(60),
    FLOW_WIDTH: "88%" as const,
    /** Fixed leading-icon column shared by settings/profile rows. */
    ICON_BOX_WIDTH: scale(32),
    /** Height of a single-line text field (search, email). */
    FIELD_HEIGHT: scale(48),
    /** Minimum height of a settings/profile row. */
    ROW_MIN_HEIGHT: scale(64),
    /** Brand logo height on the secondary screens (matches the player hero). */
    LOGO_HEIGHT: scale(127),
    /** Centered content column shared by the full-screen pages. */
    CONTENT_WIDTH: "88%" as const,
    CONTENT_MAX_WIDTH,
  },
  ELEVATION: {
    TOAST: [{ offsetX: 0, offsetY: 4, blurRadius: 8, color: "rgba(0, 0, 0, 0.35)" }],
  },
  FEEDBACK: {
    HOLD_MS: { success: 2400, info: 3200, error: 5000 },
    MASK_AUTO_HIDE_MS: 5000,
  },
  SCROLL: { EVENT_THROTTLE: 16 },
  CHART: { HEAT_WEEKS: 26, CELL: 10, GAP: 2, RADIUS: 2, BAR_HEIGHT: 72, BAR_MIN: 2 },
};
