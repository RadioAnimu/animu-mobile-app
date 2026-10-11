import { useEffect, type RefObject } from "react";
import type { TextInput } from "react-native";

import { focusWithKeyboard } from "@/utils/keyboard";

/**
 * Focuses a text input — with its keyboard up — once it has mounted and laid
 * out. This is the one way a field takes focus by itself in this app; the
 * native `autoFocus` prop is not used.
 *
 * `autoFocus` fires during the native mount, which loses the race when the
 * field swaps in for another one: the outgoing field resigns the first
 * responder in the same commit (taking the keyboard down with it) and a
 * scroll view may still be laying the new step out. Worse, the new field
 * then reads as focused, so a plain `focus()` fallback is ignored and the
 * keyboard never shows (the Animu Connect code step). Waiting two frames —
 * after the commit has mounted and laid out — and then focusing through
 * {@link focusWithKeyboard} raises the keyboard every time.
 */
export function useFocusOnMount(
  ref: RefObject<TextInput | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => focusWithKeyboard(ref.current));
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, ref]);
}
