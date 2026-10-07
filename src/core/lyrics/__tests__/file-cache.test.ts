import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system", () => ({ Directory: vi.fn(), File: vi.fn(), Paths: { cache: "file://cache" } }));

const { fileNameOf } = await import("@/core/lyrics/file-cache");

describe("fileNameOf", () => {
  it("is stable, file-safe and distinct per song", () => {
    const key = "gurenge|lisa|235";
    expect(fileNameOf(key)).toBe(fileNameOf(key));
    expect(fileNameOf(key)).toMatch(/^[0-9a-f]{8}-\d+\.json$/);
    expect(fileNameOf(key)).not.toBe(fileNameOf("gurenge|lisa|90"));
    expect(fileNameOf("新時代|ado|227")).toMatch(/^[0-9a-f]{8}-\d+\.json$/);
  });
});
