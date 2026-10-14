// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyricsHeader } from "@/screens/Lyrics/LyricsHeader";

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("react-native-gesture-handler", () => {
  const pan = { activeOffsetY: () => pan, onEnd: () => pan };
  return {
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock("react-native-worklets", () => ({ scheduleOnRN: vi.fn() }));
vi.mock("@/components/Cover", () => ({ Cover: () => <i data-cover /> }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) }),
}));

describe("LyricsHeader", () => {
  afterEach(cleanup);

  it("closes from the song (cover, title, artist), not only the grabber", () => {
    const onClose = vi.fn();
    render(<LyricsHeader cover="file:///cover.jpg" title="Our Carol" subtitle="Roselia" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Our Carol, Roselia" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "A11Y_CLOSE_LYRICS" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("names the song alone while there is no artist line", () => {
    render(<LyricsHeader cover={undefined} title="Our Carol" subtitle="" onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Our Carol" })).toBeTruthy();
  });
});
