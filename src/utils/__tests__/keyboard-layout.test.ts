import { describe, expect, it } from "vitest";
import { inputScrollDelta } from "@/utils/keyboard-layout";

describe("input visibility", () => {
  const viewport = { top: 100, bottom: 500, gap: 12, actionSpace: 64 };
  it("leaves an already visible field and action in place", () => {
    expect(inputScrollDelta({ ...viewport, inputTop: 200, inputHeight: 48 })).toBe(0);
  });
  it("scrolls only the overlap, retaining room for the next action", () => {
    expect(inputScrollDelta({ ...viewport, inputTop: 460, inputHeight: 48 })).toBe(84);
  });
  it("handles a tiny keyboard viewport without scrolling the field off the top", () => {
    expect(inputScrollDelta({ ...viewport, bottom: 180, inputTop: 112, inputHeight: 80 })).toBe(0);
  });
  it("reveals an input that is above the viewport", () => {
    expect(inputScrollDelta({ ...viewport, inputTop: 80, inputHeight: 48 })).toBe(-32);
  });
  it("measures the real footer including a new inline error and secondary actions", () => {
    expect(inputScrollDelta({ ...viewport, inputTop: 350, inputHeight: 60, regionBottom: 540 })).toBe(52);
  });
  it("keeps a field visible when a large-text form footer exceeds the viewport", () => {
    expect(inputScrollDelta({ ...viewport, inputTop: 200, inputHeight: 60, regionBottom: 900 })).toBe(88);
  });
});
