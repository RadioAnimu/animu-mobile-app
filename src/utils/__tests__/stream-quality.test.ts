import { describe, expect, it } from "vitest";
import type { Stream } from "@/core/domain/stream";
import { shownQuality } from "@/utils/stream-quality";

const stream = (id: string): Stream => ({ id, bitrate: Number(id), category: "MP3", url: `https://s.test/${id}` });
const HIGH = stream("320");
const LOW = stream("64");

describe("shownQuality", () => {
  it("marks the pick, switching while another stream is heard", () => {
    expect(shownQuality({ currentStream: HIGH, playingStream: LOW, isPlaying: true })).toEqual({
      stream: HIGH,
      switching: true,
    });
    expect(shownQuality({ currentStream: HIGH, playingStream: HIGH, isPlaying: true }).switching).toBe(false);
  });

  it("is not switching while paused or before anything is heard", () => {
    expect(shownQuality({ currentStream: HIGH, playingStream: LOW, isPlaying: false }).switching).toBe(false);
    expect(shownQuality({ currentStream: HIGH, isPlaying: true }).switching).toBe(false);
  });

  it("under automatic quality marks the stream heard, else the one a load opens at", () => {
    expect(shownQuality({ autoQuality: true, currentStream: HIGH, playingStream: LOW, isPlaying: true })).toEqual({
      stream: LOW,
      switching: false,
    });
    expect(shownQuality({ autoQuality: true, currentStream: HIGH, isPlaying: false }).stream).toBe(HIGH);
  });
});
