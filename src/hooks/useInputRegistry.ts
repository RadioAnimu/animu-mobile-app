import { useCallback, useRef } from "react";
import type { TextInput } from "react-native";

/**
 * Keyed registry of text inputs for "next field" focus chaining and focusing
 * the first invalid field. `register` is a ref callback; `focus` runs from
 * event handlers only, never during render.
 */
export function useInputRegistry<K extends string>() {
  const inputs = useRef<Partial<Record<K, TextInput | null>>>({});

  const register = useCallback((key: K, node: TextInput | null) => {
    inputs.current[key] = node;
  }, []);

  const focus = useCallback((key: K) => {
    inputs.current[key]?.focus();
  }, []);

  return { register, focus };
}
