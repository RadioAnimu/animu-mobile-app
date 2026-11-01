// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  getMissingLiveFields,
  useLiveRequestForm,
} from "@/hooks/useLiveRequestForm";

afterEach(cleanup);

describe("useLiveRequestForm", () => {
  it("prefills from the initial data", () => {
    const { result } = renderHook(() =>
      useLiveRequestForm({ name: "Haru", city: "São Paulo" }),
    );

    expect(result.current.formData.name).toBe("Haru");
    expect(result.current.formData.city).toBe("São Paulo");
    expect(result.current.formData.artist).toBe("");
  });

  it("updates one field at a time", () => {
    const { result } = renderHook(() => useLiveRequestForm({ name: "Haru" }));

    act(() => result.current.setField("artist", "LiSA"));

    expect(result.current.formData.artist).toBe("LiSA");
    expect(result.current.formData.name).toBe("Haru");
  });

  it("resets every field", () => {
    const { result } = renderHook(() => useLiveRequestForm({ name: "Haru" }));

    act(() => result.current.reset());

    expect(result.current.formData).toEqual({
      name: "",
      city: "",
      artist: "",
      music: "",
      anime: "",
      request: "",
    });
  });
});

describe("getMissingLiveFields", () => {
  const filled = {
    name: "a",
    city: "b",
    artist: "c",
    music: "d",
    anime: "e",
    request: "",
  };

  it("returns nothing when every required field is filled", () => {
    expect(getMissingLiveFields(filled)).toEqual([]);
  });

  it("lists blank and whitespace-only fields in on-screen order", () => {
    expect(
      getMissingLiveFields({ ...filled, anime: "", city: "   ", music: "" }),
    ).toEqual(["city", "music", "anime"]);
  });

  it("never requires the optional message", () => {
    expect(getMissingLiveFields({ ...filled, request: "" })).toEqual([]);
  });
});
