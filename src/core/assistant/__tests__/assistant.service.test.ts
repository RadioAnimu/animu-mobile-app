import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAssistantUrl } from "@/core/assistant/assistant.service";

const parse = vi.hoisted(() => vi.fn());

vi.mock("expo-linking", () => ({ parse }));
vi.mock("react-native", () => ({
  Linking: { addEventListener: vi.fn(), getInitialURL: vi.fn() },
}));

describe("parseAssistantUrl", () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it("returns null for empty input without parsing", () => {
    expect(parseAssistantUrl(null)).toBeNull();
    expect(parseAssistantUrl("")).toBeNull();
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects other hosts", () => {
    parse.mockReturnValue({ hostname: "other", path: "play" });
    expect(parseAssistantUrl("animuapp://other/play")).toBeNull();
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["play"],
    ["/play"],
    ["play/"],
    ["///play///"],
    ["/"],
    ["////"],
  ])("accepts the play action for path %j", (path) => {
    parse.mockReturnValue({ hostname: "assistant", path });
    expect(parseAssistantUrl("animuapp://assistant")).toBe("play");
  });

  it.each([["pause"], ["play/extra"], ["/a/play"], ["play x"], ["/ play"]])(
    "rejects path %j",
    (path) => {
      parse.mockReturnValue({ hostname: "assistant", path });
      expect(parseAssistantUrl("animuapp://assistant")).toBeNull();
    },
  );

  it("handles a pathological slash run in linear time", () => {
    parse.mockReturnValue({
      hostname: "assistant",
      path: `${"/".repeat(200_000)}x`,
    });
    const started = Date.now();
    expect(parseAssistantUrl("animuapp://assistant")).toBeNull();
    expect(Date.now() - started).toBeLessThan(500);
  });
});
