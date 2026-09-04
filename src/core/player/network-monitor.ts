export interface ConnectivityState {
  isConnected: boolean | null;
}

export type ConnectivitySubscribe = (
  handler: (state: ConnectivityState) => void,
) => () => void;

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
      const isConnected = !!state.isConnected;
      const wasConnected = this.wasConnected;
      this.wasConnected = isConnected;

      if (wasConnected === false && isConnected) {
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
