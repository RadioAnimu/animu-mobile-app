// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useLiveRequestForm } from "@/hooks/useLiveRequestForm";

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

  it("updates fields through the setters", () => {
    const { result } = renderHook(() => useLiveRequestForm());

    act(() => result.current.setters.setArtist("LiSA"));

    expect(result.current.formData.artist).toBe("LiSA");
  });

  it("is invalid until every required field is filled", () => {
    const { result } = renderHook(() => useLiveRequestForm());
    expect(result.current.isFormValid()).toBe(false);

    act(() => {
      result.current.setters.setName("a");
      result.current.setters.setCity("b");
      result.current.setters.setArtist("c");
      result.current.setters.setMusic("d");
      result.current.setters.setAnime("e");
    });

    expect(result.current.isFormValid()).toBe(true);
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

  it("returns the current values from getFormData", () => {
    const { result } = renderHook(() => useLiveRequestForm());

    act(() => result.current.setters.setMusic("Gurenge"));

    expect(result.current.getFormData().music).toBe("Gurenge");
  });
});
