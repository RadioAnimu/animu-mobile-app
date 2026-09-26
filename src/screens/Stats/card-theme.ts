import { THEME } from "@/theme";

/**
 * Visual theme for the share card, derived from the banner's accent color
 * (the provider extracts it from the banner image itself — a solid proxy
 * for the banner palette, so no pixel decoding is needed).
 *
 * The banner is always dimmed ("stained") with a scrim; the scrim and the
 * text colors flip together so the text keeps WCAG-comfortable contrast on
 * both dark and bright banners.
 */
export interface CardTheme {
  /** Primary text color (name, stat values). */
  text: string;
  /** Secondary text color (labels, handle, brand). */
  subtext: string;
  /** Dimming layer over the banner. */
  scrim: string;
  /** Avatar ring / divider color. */
  ring: string;
}

/** Relative luminance (WCAG) of a #rgb/#rrggbb hex color, 0 (black) → 1 (white). */
export const hexLuminance = (hex: string): number => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const parts =
    match[1].length === 3
      ? match[1].split("").map((c) => c + c)
      : [match[1].slice(0, 2), match[1].slice(2, 4), match[1].slice(4, 6)];
  const [r, g, b] = parts.map((c) => {
    const v = parseInt(c, 16) / 255;
    // Linearize per WCAG.
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const cardThemeFromAccent = (accent: string | undefined): CardTheme => {
  const luminance = accent ? hexLuminance(accent) : 0;
  // Bright banners get a light stain + ink text; dark ones the app's deep
  // purple stain + white text.
  if (luminance > 0.55) {
    return {
      text: THEME.COLORS.BG_DEEP,
      subtext: "rgba(22, 1, 53, 0.72)",
      scrim: "rgba(255, 255, 255, 0.42)",
      ring: "rgba(22, 1, 53, 0.35)",
    };
  }
  return {
    text: THEME.COLORS.TEXT,
    subtext: "rgba(255, 255, 255, 0.72)",
    scrim: "rgba(22, 1, 53, 0.55)",
    ring: THEME.COLORS.BRAND,
  };
};
