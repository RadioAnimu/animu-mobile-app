import { useCallback, useState } from "react";
import type { ToastVariant } from "@/components/Toast";

export interface ChipState {
  message: string;
  variant: ToastVariant;
  /** Bumped per call so a repeat of the same message re-animates. */
  seed: number;
}

/** Local status chip for surfaces (modals) the app-level toast can't cover. */
export function useChip() {
  const [chip, setChip] = useState<ChipState | null>(null);

  const showChip = useCallback((message: string, variant: ToastVariant) => {
    setChip((prev) => ({ message, variant, seed: (prev?.seed ?? 0) + 1 }));
  }, []);

  const clearChip = useCallback(() => setChip(null), []);

  return { chip, showChip, clearChip };
}
