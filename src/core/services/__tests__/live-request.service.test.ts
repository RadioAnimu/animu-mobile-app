import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "animu-api";

import { liveRequestService } from "@/core/services/live-request.service";
import type { LiveRequest } from "@/core/domain/live-request";

const { submitLiveRequest } = vi.hoisted(() => ({
  submitLiveRequest: vi.fn(),
}));
vi.mock("@/api/client", () => ({ animuApi: { submitLiveRequest } }));

const request: LiveRequest = {
  name: "Haru",
  city: "São Paulo",
  artist: "LiSA",
  music: "Gurenge",
  anime: "Kimetsu no Yaiba",
  request: "",
};

afterEach(() => submitLiveRequest.mockReset());

describe("liveRequestService.submitRequest", () => {
  it("reports success when the server confirms", async () => {
    submitLiveRequest.mockResolvedValueOnce(true);
    await expect(liveRequestService.submitRequest(request)).resolves.toEqual({
      success: true,
    });
  });

  it("reports REQUEST_ERROR when the server declines", async () => {
    submitLiveRequest.mockResolvedValueOnce(false);
    await expect(liveRequestService.submitRequest(request)).resolves.toEqual({
      success: false,
      error: "REQUEST_ERROR",
    });
  });

  it("maps a validation failure to VALIDATION with the message as detail", async () => {
    submitLiveRequest.mockRejectedValueOnce(
      new ValidationError("name is required", "https://api.test"),
    );
    await expect(liveRequestService.submitRequest(request)).resolves.toEqual({
      success: false,
      error: "VALIDATION",
      detail: "name is required",
    });
  });

  it("normalizes any other failure to REQUEST_ERROR", async () => {
    submitLiveRequest.mockRejectedValueOnce(new Error("network down"));
    await expect(liveRequestService.submitRequest(request)).resolves.toEqual({
      success: false,
      error: "REQUEST_ERROR",
    });
  });

  it("rejects a concurrent submission with IN_PROGRESS", async () => {
    let resolveRequest: ((value: boolean) => void) | undefined;
    submitLiveRequest.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = liveRequestService.submitRequest(request);
    await expect(liveRequestService.submitRequest(request)).resolves.toEqual({
      success: false,
      error: "IN_PROGRESS",
    });

    resolveRequest?.(true);
    await expect(first).resolves.toEqual({ success: true });
  });
});
