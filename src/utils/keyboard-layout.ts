/** Minimum scroll needed to reveal a field in the current visible viewport. */
export function inputScrollDelta({
  top, bottom, inputTop, inputHeight, gap, actionSpace, regionBottom,
}: {
  top: number;
  bottom: number;
  inputTop: number;
  inputHeight: number;
  gap: number;
  actionSpace: number;
  regionBottom?: number;
}): number {
  const available = Math.max(0, bottom - top - gap * 2);
  const fieldHeight = Math.min(inputHeight, available);
  const requestedSpace = regionBottom == null ? actionSpace : Math.max(0, regionBottom - inputTop - fieldHeight);
  const trailing = Math.min(requestedSpace, Math.max(0, available - fieldHeight));
  const overflow = inputTop + fieldHeight + trailing + gap - bottom;
  if (overflow > 0) return overflow;
  if (inputTop < top + gap) return inputTop - top - gap;
  return 0;
}
