export interface ConnectivityState {
  isConnected: boolean | null;
  /**
   * Whether the OS can actually reach the internet, not just associate with
   * an access point. `null` means "not determined yet" and is treated as
   * still-online so an unknown probe never flaps the stream.
   */
  isInternetReachable?: boolean | null;
}

export type ConnectivitySubscribe = (
  handler: (state: ConnectivityState) => void,
) => () => void;

/**
 * A link is only "online" when it is connected AND not known to be unable
 * to reach the internet. Captive portals and "Wi-Fi with no internet"
 * report `isConnected: true` with `isInternetReachable: false` — without
 * this the monitor never sees a restore and a live stream stuck on a dead
 * link never re-opens.
 */
const isOnline = (state: ConnectivityState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

/**
 * Watches connectivity and fires `onRestore` exactly once per
 * offline → online transition. The initial emit (NetInfo fires on
 * subscribe) only seeds the baseline — it never triggers a restore.
 */
export class NetworkMonitor {
  /** Wired by the orchestrator. */
  onRestore: () => void = () => {};

  private unsubscribe: (() => void) | null = null;
  private wasConnected: boolean | null = null;

  constructor(private readonly subscribe: ConnectivitySubscribe) {}

  /** Idempotent. */
  start(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = this.subscribe((state) => {
      const online = isOnline(state);
      const wasConnected = this.wasConnected;
      this.wasConnected = online;

      if (wasConnected === false && online) {
        console.info("[NetworkMonitor] Network restored");
        this.onRestore();
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.wasConnected = null;
  }
}
