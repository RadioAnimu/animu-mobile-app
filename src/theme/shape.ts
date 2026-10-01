import { THEME } from "@/theme";

/** Apple's squircle: iOS draws corners as continuous curves (ignored on Android). */
export const CONTINUOUS = { borderCurve: "continuous" } as const;

/** Rounded-square identity images (avatars) use the app-icon ratio. */
export const avatarRadius = (size: number) => Math.round(size * 0.22);

/** A container hugging a rounded child by `inset` has the child's radius plus the inset. */
export const concentric = (innerRadius: number, inset: number) =>
  innerRadius + inset;

/** Hard (blur-free) drop shadow — the sticker look. */
export const hardShadow = (
  color: string = THEME.COLORS.BG_DEEP,
  offsetY = 4,
) => ({
  boxShadow: [{ offsetX: 0, offsetY, blurRadius: 0, color }],
});
