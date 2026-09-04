import { describe, expect, it } from "vitest";
import { NetworkMonitor } from "../network-monitor";

const makeMonitor = () => {
  let handler: ((state: { isConnected: boolean | null }) => void) | null = null;
  let unsubscribed = 0;
  let restores = 0;

  const subscribe = (next: (state: { isConnected: boolean | null }) => void) => {
    handler = next;
    return () => {
      unsubscribed++;
      handler = null;
    };
  };

  const monitor = new NetworkMonitor(subscribe);
  monitor.onRestore = () => restores++;

  return {
    monitor,
    emit: (isConnected: boolean | null) => handler?.({ isConnected }),
    get restores() {
      return restores;
    },
    get unsubscribed() {
      return unsubscribed;
    },
  };
};

describe("NetworkMonitor", () => {
  it("only reacts to offline → online transitions", () => {
    const f = makeMonitor();

    f.monitor.start();

    f.emit(true); // initial emit on subscribe — baseline only
    expect(f.restores).toBe(0);

    f.emit(false);
    expect(f.restores).toBe(0);

    f.emit(true); // offline → online
    expect(f.restores).toBe(1);

    f.emit(true); // no transition
    expect(f.restores).toBe(1);

    f.emit(false);
    f.emit(false);
    f.emit(true); // second restore
    expect(f.restores).toBe(2);
  });

  it("treats unknown connectivity as not-connected", () => {
    const f = makeMonitor();

    f.monitor.start();
    f.emit(null); // baseline
    f.emit(true); // first known-online transition counts as a restore
    expect(f.restores).toBe(1);
  });

  it("is idempotent on start and resets on stop", () => {
    const f = makeMonitor();

    f.monitor.start();
    f.monitor.start(); // second call ignored
    f.emit(true);
    expect(f.restores).toBe(0);

    f.monitor.stop();
    expect(f.unsubscribed).toBe(1);

    f.monitor.start();
    f.emit(true); // baseline again after restart
    expect(f.restores).toBe(0);
  });
});
