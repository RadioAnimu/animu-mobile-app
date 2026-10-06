import { createContext, useContext, type RefObject } from "react";
import type { TextInput, View } from "react-native";

export const InputVisibilityContext = createContext<(input: TextInput | null, region?: View | null) => void>(() => {});
export const InputRegionContext = createContext<RefObject<View | null> | null>(null);
export function useInputVisibility() {
  const reveal = useContext(InputVisibilityContext);
  const region = useContext(InputRegionContext);
  return (input: TextInput | null) => reveal(input, region?.current);
}
