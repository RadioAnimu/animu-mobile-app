import { describe, expect, it } from "vitest";
import { NetworkMonitor, type ConnectivityState } from "@/core/player/stream-playback/network-monitor";

const makeMonitor = () => {
  let handler: ((state: ConnectivityState) => void) | null = null;
  let unsubscribed = 0;
  let restores = 0;

  const subscribe = (next: (state: ConnectivityState) => void) => {
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
    emitState: (state: ConnectivityState) => handler?.(state),
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

  it("fires a restore when Wi-Fi stays associated but internet returns", () => {
    const f = makeMonitor();

    f.monitor.start();
    // Wi-Fi with no internet: connected, but the OS cannot reach the
    // internet — this must NOT count as online.
    f.emitState({ isConnected: true, isInternetReachable: false });
    expect(f.restores).toBe(0);

    // Internet finally comes back on the same link → restore.
    f.emitState({ isConnected: true, isInternetReachable: true });
    expect(f.restores).toBe(1);
  });

  it("treats unknown reachability as still-online", () => {
    const f = makeMonitor();

    f.monitor.start();
    f.emitState({ isConnected: false }); // baseline offline
    f.emitState({ isConnected: true, isInternetReachable: null });
    expect(f.restores).toBe(1);

    // A later probe resolving to unreachable does not count as a second
    // restore when it comes back (single offline → online transition).
    f.emitState({ isConnected: true, isInternetReachable: false });
    f.emitState({ isConnected: true, isInternetReachable: true });
    expect(f.restores).toBe(2);
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
