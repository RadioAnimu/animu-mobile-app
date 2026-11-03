/**
 * Minimal DOM-backed stand-in for `react-native`, for jsdom component tests.
 *
 * Every test file gets it by default (`src/__tests__/setup.ts`). To change a
 * piece, mock again and extend it (factories are hoisted, so import inside):
 *
 *   vi.mock("react-native", async () => ({
 *     ...(await import("@/__tests__/react-native-mock")).createReactNativeMock(),
 *     Platform: { OS: "android", select: (o: { android?: unknown }) => o.android },
 *   }));
 *
 * Host components render plain DOM elements and forward the props a behavior
 * test needs: accessibility label/role/state, testID, press and text-change
 * handlers. `onLayout` handlers are stashed on the element so tests can fire
 * them with `fireLayout`.
 */
import * as React from "react";
import { vi } from "vitest";

type Style = Record<string, unknown>;
type LayoutHandler = (event: unknown) => void;
type LayoutCapable = HTMLElement & { __onLayout?: LayoutHandler };

/** The accessibility and identity props every host forwards to the DOM. */
interface A11yProps {
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityState?: {
    expanded?: boolean;
    selected?: boolean;
    checked?: boolean;
    busy?: boolean;
    disabled?: boolean;
  };
  accessibilityValue?: { text?: string };
  disabled?: boolean;
  testID?: string;
}

interface HostProps extends A11yProps {
  children?: React.ReactNode;
  style?: unknown;
  onLayout?: LayoutHandler;
  /** Accepted (React 19 passes it as a prop) but not attached. */
  ref?: React.Ref<unknown>;
}

interface TouchableProps extends HostProps {
  onPress?: (event: unknown) => void;
  focusable?: boolean;
}

interface PressableProps extends Omit<TouchableProps, "style"> {
  style?: unknown;
}

interface TextInputProps extends A11yProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onSubmitEditing?: () => void;
  editable?: boolean;
  style?: unknown;
  maxLength?: number;
  autoFocus?: boolean;
}

interface FlatListProps {
  data: readonly unknown[];
  renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
  keyExtractor?: (item: unknown, index: number) => React.Key;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
}

const flattenStyle = (style: unknown): Style => {
  if (Array.isArray(style)) {
    return style.reduce<Style>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }
  return style && typeof style === "object" ? (style as Style) : {};
};

function a11yProps(props: A11yProps) {
  const state = props.accessibilityState ?? {};
  return {
    role: props.accessibilityRole,
    "aria-label": props.accessibilityLabel,
    "aria-expanded": state.expanded,
    "aria-selected": state.selected,
    "aria-checked": state.checked,
    "aria-valuetext": props.accessibilityValue?.text,
    "aria-busy": state.busy,
    "aria-disabled": props.disabled || state.disabled || undefined,
    "data-testid": props.testID,
  };
}

function useLayoutHandler(onLayout: LayoutHandler | undefined) {
  const ref = React.useRef<LayoutCapable | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.__onLayout = onLayout;
  });
  return ref;
}

const host = (tag: string) => {
  const Component = ({ children, style, onLayout, ...props }: HostProps) => {
    const ref = useLayoutHandler(onLayout);
    return React.createElement(
      tag,
      { ref, ...a11yProps(props), "data-style": JSON.stringify(flattenStyle(style)) },
      children,
    );
  };
  return Component;
};

function Touchable({
  children,
  onPress,
  disabled,
  style,
  onLayout,
  focusable,
  ...props
}: TouchableProps) {
  const ref = useLayoutHandler(onLayout);
  return React.createElement(
    "div",
    {
      ref,
      ...a11yProps({ ...props, disabled }),
      "data-style": JSON.stringify(flattenStyle(style)),
      // Keyboard focus, surfaced only when set.
      ...(focusable === undefined ? {} : { "data-focusable": String(focusable) }),
      onClick: disabled ? undefined : onPress,
    },
    children,
  );
}

function Pressable({ children, style, ...props }: PressableProps) {
  const resolvedStyle =
    typeof style === "function"
      ? (style as (state: { pressed: boolean }) => unknown)({ pressed: false })
      : style;
  return Touchable({ ...props, style: resolvedStyle, children });
}

const TextInput = React.forwardRef<
  { focus: () => void; isFocused: () => boolean },
  TextInputProps
>(
  function TextInput(
    {
      value,
      onChangeText,
      onFocus,
      onBlur,
      onSubmitEditing,
      editable = true,
      style,
      ...props
    },
    ref,
  ) {
    const input = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(ref, () => ({
      focus: () => {
        input.current?.focus();
      },
      isFocused: () => document.activeElement === input.current,
    }));
    return React.createElement("input", {
      ref: input,
      ...a11yProps(props),
      role: props.accessibilityRole ?? "textbox",
      value,
      disabled: !editable,
      maxLength: props.maxLength,
      autoFocus: props.autoFocus,
      "data-style": JSON.stringify(flattenStyle(style)),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChangeText?.(event.target.value),
      onFocus,
      onBlur,
      // The keyboard's search/submit key.
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter") onSubmitEditing?.();
      },
    });
  },
);

/** Renders every item (no virtualization), with the header and footer. */
function FlatList({ data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent }: FlatListProps) {
  return React.createElement(
    "div",
    null,
    ListHeaderComponent ?? null,
    data.map((item, index) =>
      React.createElement(React.Fragment, { key: keyExtractor ? keyExtractor(item, index) : index }, renderItem({ item, index })),
    ),
    ListFooterComponent ?? null,
  );
}

function ActivityIndicator({ testID }: { testID?: string }) {
  return React.createElement("div", {
    role: "progressbar",
    "data-testid": testID,
  });
}

function Image({ source, testID }: { source?: unknown; testID?: string }) {
  return React.createElement("img", {
    alt: "",
    "data-testid": testID,
    "data-source": JSON.stringify(source),
  });
}

class AnimatedValue {
  constructor(public value: number) {}
  setValue(next: number) {
    this.value = next;
  }
  interpolate() {
    return this;
  }
}

const animation = () => {
  const handle = { start: vi.fn(), stop: vi.fn(), reset: vi.fn() };
  return handle;
};

/** What every mocked `Animated` factory (timing, loop, ...) returns. */
export type MockAnimation = ReturnType<typeof animation>;

export function createReactNativeMock() {
  return {
    View: host("div"),
    Text: host("span"),
    ScrollView: host("div"),
    FlatList,
    TouchableOpacity: Touchable,
    Pressable,
    TextInput,
    ActivityIndicator,
    Image,
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: flattenStyle,
      absoluteFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    },
    Animated: {
      Value: AnimatedValue,
      View: host("div"),
      Text: host("span"),
      timing: vi.fn(animation),
      spring: vi.fn(animation),
      sequence: vi.fn(animation),
      loop: vi.fn(animation),
      delay: vi.fn(animation),
      add: (a: AnimatedValue) => a,
      multiply: (a: AnimatedValue) => a,
    },
    Easing: {
      linear: "linear",
      ease: "ease",
      cubic: "cubic",
      in: (fn: unknown) => fn,
      out: (fn: unknown) => fn,
      inOut: (fn: unknown) => fn,
    },
    AccessibilityInfo: {
      isReduceMotionEnabled: vi.fn(() => Promise.resolve(false)),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      announceForAccessibility: vi.fn(),
    },
    PanResponder: {
      create: vi.fn(() => ({ panHandlers: {} })),
    },
    Alert: { alert: vi.fn() },
    InteractionManager: {
      runAfterInteractions: (task: () => void) => {
        task();
        return { cancel: () => {} };
      },
    },
    Keyboard: {
      dismiss: vi.fn(),
      isVisible: vi.fn(() => false),
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    LayoutAnimation: {
      configureNext: vi.fn(),
      Types: { easeInEaseOut: "easeInEaseOut", keyboard: "keyboard" },
    },
    Platform: {
      OS: "android",
      select: <T,>(spec: { android?: T; default?: T }) => spec.android ?? spec.default,
    },
    Dimensions: { get: () => ({ width: 393, height: 852 }) },
    PixelRatio: { getFontScale: () => 1, get: () => 1 },
    useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }),
  };
}

/** Simulates RN's `onLayout` on a rendered element with the given width. */
export function fireLayout(element: Element, width: number, height = 20): void {
  const handler = (element as LayoutCapable).__onLayout;
  if (!handler) throw new Error("element has no onLayout handler");
  handler({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

/**
 * Stand-in for `@react-native-vector-icons/*`: renders the icon name as text
 * so tests can assert which glyph a control shows.
 */
export function createIconMock() {
  return {
    default: ({ name }: { name: string }) =>
      React.createElement("i", { "data-icon": name }),
  };
}
