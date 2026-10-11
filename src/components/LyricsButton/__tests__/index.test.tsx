// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyricsButton } from "@/components/LyricsButton";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  restore: vi.fn(async () => {}),
  availability: "available" as string,
}));

vi.mock("react-native", async () => (await import("@/__tests__/react-native-mock")).createReactNativeMock());
vi.mock("@react-navigation/native", () => ({ useNavigation: () => ({ navigate: mocks.navigate }) }));
vi.mock("@/components/Icon", () => ({
  Icon: ({ name, color }: { name: string; color: string }) => <i data-icon={name} data-color={color} />,
}));
vi.mock("@/core/japanese", () => ({ japaneseDictionary: { restore: mocks.restore } }));
vi.mock("@/hooks/useLyricsAvailability", () => ({ useLyricsAvailability: () => mocks.availability }));
vi.mock("@/hooks/useDict", () => ({
  useDict: () => ({ A11Y_OPEN_LYRICS: "Show lyrics", LYRICS_MISSING: "No lyrics yet" }),
}));
vi.mock("@/utils/haptics", () => ({ haptics: { tap: vi.fn() } }));

const button = () => screen.getByRole("button", { name: "Show lyrics" });
const icon = () => button().querySelector("i")!;

describe("LyricsButton", () => {
  afterEach(cleanup);

  it("is a green microphone that opens the lyrics", () => {
    mocks.availability = "available";
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(icon().getAttribute("data-icon")).toBe("mic");
    expect(icon().getAttribute("data-color")).toBe("#6BDB00");
    fireEvent.click(button());
    expect(mocks.navigate).toHaveBeenCalledWith("Lyrics");
  });

  it.each(["missing", "checking"])("is greyed out and inactive while %s", (availability) => {
    mocks.availability = availability;
    mocks.navigate.mockClear();
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(button().getAttribute("aria-disabled")).toBe("true");
    expect(icon().getAttribute("data-color")).not.toBe("#6BDB00");
    fireEvent.click(button());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("stays usable after a failed lookup (the lyrics retry)", () => {
    mocks.availability = "unknown";
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(button().getAttribute("aria-disabled")).toBeNull();
  });

  it("cleans up an interrupted dictionary install at launch", () => {
    render(<LyricsButton size={27} hitSlop={7} />);
    expect(mocks.restore).toHaveBeenCalled();
  });
});
