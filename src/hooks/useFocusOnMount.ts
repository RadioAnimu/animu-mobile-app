import { useEffect, type RefObject } from "react";
import type { TextInput } from "react-native";

/**
 * Focuses a text input once it has mounted and laid out — the reliable
 * replacement for the `autoFocus` prop on fields that appear mid-flow.
 *
 * `autoFocus` fires during the native mount, which loses the race when the
 * field swaps in for another one: the outgoing field resigns the first
 * responder in the same commit (taking the keyboard down with it) and a
 * scroll view may still be laying the new step out, so the keyboard simply
 * never shows. Focusing two frames later — after the commit has mounted and
 * laid out — raises the keyboard every time; an already-focused field is
 * left alone.
 */
export function useFocusOnMount(
  ref: RefObject<TextInput | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const input = ref.current;
        if (input && !input.isFocused()) input.focus();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, ref]);
}
