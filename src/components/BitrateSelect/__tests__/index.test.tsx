// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BitrateSelect } from "@/components/BitrateSelect";

const mocks = vi.hoisted(() => ({
  changeStream: vi.fn(async () => {}),
  select: vi.fn(),
  current: "https://stream.test/320",
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  const rn = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  const Plain = rn.TouchableOpacity as React.FC<Record<string, unknown>>;
  return {
    ...rn,
    // The pill measures itself to anchor the list under it.
    TouchableOpacity: React.forwardRef(function MeasuredTouchable(props: Record<string, unknown>, ref) {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
          callback(600, 20, 150, 30),
      }));
      return <Plain {...props} />;
    }),
    ScrollView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Modal: ({ visible, children }: { visible: boolean; children?: React.ReactNode }) =>
      visible ? <section data-testid="popover">{children}</section> : null,
  };
});
vi.mock("@react-native-vector-icons/material-icons/static", async () =>
  (await import("@/__tests__/react-native-mock")).createIconMock(),
);
vi.mock("@/utils/haptics", () => ({ haptics: { select: mocks.select } }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ A11Y_STREAM_QUALITY: "Audio quality", A11Y_CLOSE: "Close" }),
}));

const STREAMS = [
  { url: "https://stream.test/320", category: "MP3", bitrate: 320 },
  { url: "https://stream.test/192", category: "MP3", bitrate: 192 },
  { url: "https://stream.test/64", category: "AAC+", bitrate: 64 },
];
vi.mock("@/contexts/player/PlayerProvider", () => ({
  usePlayer: () => ({
    streamOptions: STREAMS,
    currentStream: { url: mocks.current },
    changeStream: mocks.changeStream,
  }),
}));

const pill = () => screen.getByRole("button", { name: /Audio quality/ });

describe("BitrateSelect", () => {
  beforeEach(() => {
    mocks.changeStream.mockClear();
    mocks.select.mockClear();
  });
  afterEach(cleanup);

  it("names the playing stream the website player's way", () => {
    render(<BitrateSelect />);
    expect(pill().getAttribute("aria-label")).toBe("Audio quality, 320 KBPS (MP3)");
    expect(screen.queryByTestId("popover")).toBeNull();
  });

  it("floats the streams under the pill, a check on the one playing", () => {
    render(<BitrateSelect />);
    fireEvent.click(pill());
    const options = screen.getAllByRole("radio");
    expect(options.map((option) => option.getAttribute("aria-label"))).toEqual([
      "320 KBPS (MP3)",
      "192 KBPS (MP3)",
      "64 KBPS (AAC+)",
    ]);
    expect(options[0].getAttribute("aria-checked")).toBe("true");
    // Under the pill (y 20 + h 30 + gap), held inside the 393pt window even
    // though the measured pill sits past its edge.
    const list = screen.getByRole("radiogroup");
    const style = JSON.parse(list.getAttribute("data-style")!);
    expect(style.top).toBeGreaterThan(50);
    expect(style.right).toBeGreaterThan(0);
    expect(style.maxHeight).toBeLessThan(852 - style.top);
  });

  it("switches the stream and folds the list; the playing one changes nothing", () => {
    render(<BitrateSelect />);
    fireEvent.click(pill());
    fireEvent.click(screen.getByRole("radio", { name: "64 KBPS (AAC+)" }));
    expect(mocks.changeStream).toHaveBeenCalledWith(STREAMS[2]);
    expect(mocks.select).toHaveBeenCalled();
    expect(screen.queryByTestId("popover")).toBeNull();

    fireEvent.click(pill());
    fireEvent.click(screen.getByRole("radio", { name: "320 KBPS (MP3)" }));
    expect(mocks.changeStream).toHaveBeenCalledTimes(1);
  });

  it("closes on a tap outside", () => {
    render(<BitrateSelect />);
    fireEvent.click(pill());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("popover")).toBeNull();
  });
});
