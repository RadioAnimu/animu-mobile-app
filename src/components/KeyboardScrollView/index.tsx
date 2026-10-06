import { useCallback, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, TextInput, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { THEME } from "@/theme";
import { inputScrollDelta } from "@/utils/keyboard-layout";
import { InputVisibilityContext } from "@/contexts/Portal/InputVisibilityContext";

interface Bounds { top: number; height: number }
function measure(view: Pick<View, "measureInWindow"> | null | undefined): Promise<Bounds | null> {
  return new Promise((resolve) => {
    if (!view) { resolve(null); return; }
    view.measureInWindow((_x, top, _width, height) => resolve({ top, height }));
  });
}

/**
 * Forms share one owner for keyboard avoidance. The viewport shrinks by the
 * runtime IME inset; content padding stays unchanged. A focused input scrolls
 * only as far as needed, including room for the form's next action. Sheets
 * already avoid the keyboard, so they opt out of the viewport inset.
 */
export function KeyboardScrollView({
  avoidKeyboard = true,
  bottomInsetConsumed = !avoidKeyboard,
  children,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...props
}: ScrollViewProps & { avoidKeyboard?: boolean; bottomInsetConsumed?: boolean }) {
  const keyboardPadding = useKeyboardPadding(avoidKeyboard);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const focused = useRef<{ input: TextInput | null; region?: View | null }>({ input: null });
  const offset = useRef(0);
  const frame = useRef<number | null>(null);

  const reveal = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const { input, region } = focused.current;
      const viewport = scroll.current;
      if (!input?.isFocused() || !viewport) return;
      void Promise.all([
        measure(viewport.getNativeScrollRef()), measure(input), measure(region),
      ]).then(([bounds, field, footer]) => {
        if (!bounds || !field) return;
        if (!input.isFocused() || focused.current.input !== input || scroll.current !== viewport) return;
        // Android's IME event excludes the navigation bar. Its remaining
        // inset is cleared once here, never added to the keyboard height.
        const delta = inputScrollDelta({
          top: bounds.top,
          bottom: bounds.top + bounds.height - (bottomInsetConsumed ? 0 : insets.bottom),
          inputTop: field.top,
          inputHeight: field.height,
          gap: THEME.SPACE.MD,
          actionSpace: THEME.LAYOUT.BUTTON_HEIGHT + THEME.SPACE.LG,
          regionBottom: footer ? footer.top + footer.height : undefined,
        });
        if (delta !== 0) viewport.scrollTo({
          y: Math.max(0, offset.current + delta), animated: !reducedMotion,
        });
      });
    });
  }, [insets.bottom, bottomInsetConsumed, reducedMotion]);

  const register = useCallback((input: TextInput | null, region?: View | null) => {
    focused.current = { input, region };
    reveal();
  }, [reveal]);

  useEffect(() => {
    reveal();
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [keyboardPadding, reveal]);

  return (
    <View style={[avoidKeyboard ? styles.viewport : styles.sheetViewport, { paddingBottom: keyboardPadding }]}>
      <InputVisibilityContext.Provider value={register}>
        <ScrollView
          {...props}
          ref={scroll}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={THEME.SCROLL.EVENT_THROTTLE}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
            onScroll?.(event);
          }}
          onLayout={(event) => { onLayout?.(event); reveal(); }}
          onContentSizeChange={(width, height) => {
            onContentSizeChange?.(width, height);
            reveal();
          }}
        >
          {children}
        </ScrollView>
      </InputVisibilityContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ viewport: { flex: 1 }, sheetViewport: { flexShrink: 1 } });
