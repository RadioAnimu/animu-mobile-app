import { describe, expect, it, vi } from "vitest";
import type { AnimuAuth } from "animu-api";

import { AnimuAuthAdapter } from "@/core/auth/adapters/animu-auth.adapter";

// The module wires the production singleton at import time; the default is
// never used here because every test injects its own client.
vi.mock("@/api/client", () => ({ animuApi: {} }));

const build = (result: boolean | Error) => {
  const client = {
    deleteAccount: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  return {
    client,
    adapter: new AnimuAuthAdapter(client as unknown as AnimuAuth),
  };
};

describe("AnimuAuthAdapter.deleteAccount", () => {
  it("resolves when the server confirms the deletion", async () => {
    const { client, adapter } = build(true);

    await expect(adapter.deleteAccount()).resolves.toBeUndefined();
    expect(client.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("throws when a 2xx answer does not confirm the deletion", async () => {
    const { adapter } = build(false);

    await expect(adapter.deleteAccount()).rejects.toThrow(
      "Account deletion was not confirmed by the server",
    );
  });

  it("propagates a client failure untouched", async () => {
    const failure = new Error("offline");
    const { adapter } = build(failure);

    await expect(adapter.deleteAccount()).rejects.toBe(failure);
  });
});
