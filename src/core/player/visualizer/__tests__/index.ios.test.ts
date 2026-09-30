import { describe, expect, it, vi } from "vitest";

import { createVisualizerSampler } from "@/core/player/visualizer/index.ios";
import type { SamplingTransport } from "@/core/player/visualizer/types";

describe("iOS visualizer sampler (no-op)", () => {
  const sampler = createVisualizerSampler({} as SamplingTransport);

  it("reports itself unsupported and inactive", () => {
    expect(sampler.isSupported).toBe(false);
    expect(sampler.isActive).toBe(false);
  });

  it("ignores control calls without becoming active", () => {
    sampler.setEnabled(true);
    sampler.setForeground(true);
    sampler.setPlaying(true);
    expect(sampler.isActive).toBe(false);
    expect(() => sampler.dispose()).not.toThrow();
  });

  it("never emits windows and returns a callable unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = sampler.subscribeWindows(listener);
    sampler.setEnabled(true);
    sampler.setPlaying(true);
    expect(listener).not.toHaveBeenCalled();
    expect(unsubscribe()).toBeUndefined();
  });
});
