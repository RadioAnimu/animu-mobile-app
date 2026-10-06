import { beforeEach, expect, it, vi } from "vitest";
import { canSaveToPhotoLibrary } from "@/utils/mediaLibrary";
const { platform, request } = vi.hoisted(() => ({
  platform: { OS: "android", Version: 36 as number | string },
  request: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-media-library", () => ({ requestPermissionsAsync: request }));
beforeEach(() => { platform.OS = "android"; platform.Version = 36; request.mockReset(); });
it.each([29, 36, "36"])("needs no storage permission on Android %s", async (version) => {
  platform.Version = version;
  expect(await canSaveToPhotoLibrary()).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
it.each(["android", "ios"])("requests write-only access on legacy Android or iOS (%s)", async (os) => {
  platform.OS = os;
  platform.Version = 28;
  request.mockResolvedValue({ granted: true });
  expect(await canSaveToPhotoLibrary()).toBe(true);
  expect(request).toHaveBeenCalledWith(true);
});
it("honors denial even when the user can be asked again", async () => {
  platform.OS = "ios";
  request.mockResolvedValue({ granted: false, canAskAgain: true });
  expect(await canSaveToPhotoLibrary()).toBe(false);
});
