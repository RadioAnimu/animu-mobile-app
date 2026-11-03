/**
 * Defaults for every test file: modules that cannot load under Node (native or
 * Flow code) get shared stand-ins, so a test only mocks what it is about. A
 * file's own `vi.mock` of the same module still wins.
 */
import { beforeEach, vi } from "vitest";

/** Holds the default AsyncStorage's store once a test file loaded it (see below). */
type WithStore = typeof globalThis & { __animuTestAsyncStorage?: Map<string, string> };

// Every test starts with empty storage; a file's own AsyncStorage mock is untouched.
beforeEach(() => {
  (globalThis as WithStore).__animuTestAsyncStorage?.clear();
});

vi.mock("react-native", async () =>
  (await import("@/__tests__/react-native-mock")).createReactNativeMock(),
);

// Plain host elements: enough for `@/i18n`'s inline icons and any SVG to render
// (props are dropped: nothing about an SVG can be queried).
vi.mock("react-native-svg", async () => {
  const React = await import("react");
  const host = (tag: string) => {
    const Host = ({ children }: { children?: React.ReactNode }) => React.createElement(tag, null, children);
    Host.displayName = tag;
    return Host;
  };
  const Svg = host("svg");
  return {
    default: Svg,
    Svg,
    Circle: host("circle"),
    ClipPath: host("clipPath"),
    Defs: host("defs"),
    G: host("g"),
    Line: host("line"),
    Mask: host("mask"),
    Path: host("path"),
    Rect: host("rect"),
    Text: host("text"),
  };
});

// In memory, emptied before every test (the hook above).
vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  (globalThis as WithStore).__animuTestAsyncStorage = store;
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

// An <img> naming its source, plus the cache statics the app calls, as no-ops.
vi.mock("expo-image", async () => {
  const React = await import("react");
  const Image = Object.assign(
    ({ source }: { source?: unknown }) =>
      React.createElement("img", {
        alt: "",
        "data-source":
          typeof source === "object" && source !== null && "uri" in source
            ? String(source.uri)
            : String(source),
      }),
    {
      clearDiskCache: vi.fn(async () => true),
      clearMemoryCache: vi.fn(async () => true),
      getCachePathAsync: vi.fn(async () => null),
      writeToCacheAsync: vi.fn(async () => null),
    },
  );
  return { Image };
});
