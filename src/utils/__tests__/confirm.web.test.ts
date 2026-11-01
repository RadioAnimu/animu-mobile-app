import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDestructive } from "@/utils/confirm.web";

const ask = (onConfirm: () => void) =>
  confirmDestructive({ title: "Reset?", message: "Erases it.", cancel: "Cancel", confirm: "Reset", onConfirm });

describe("confirmDestructive (web)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs the action only when the browser dialog is accepted", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const onConfirm = vi.fn();
    ask(onConfirm);
    expect(confirm).toHaveBeenCalledWith("Reset?\n\nErases it.");
    expect(onConfirm).toHaveBeenCalledTimes(1);

    confirm.mockReturnValue(false);
    ask(onConfirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
