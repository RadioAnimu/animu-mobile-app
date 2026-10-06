import { useRef } from "react";
import { View, type ViewProps } from "react-native";
import { InputRegionContext } from "@/contexts/Portal/InputVisibilityContext";

/** Measures the real form footer (errors, resend/change links and submit). */
export function KeyboardFormRegion({ children, ...props }: ViewProps) {
  const region = useRef<View>(null);
  return (
    <InputRegionContext.Provider value={region}>
      <View {...props} ref={region} collapsable={false}>{children}</View>
    </InputRegionContext.Provider>
  );
}
