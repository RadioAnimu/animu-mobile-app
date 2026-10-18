// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "@/components/ErrorBoundary";
import { PlayerProvider } from "@/contexts/player/PlayerProvider";

vi.mock("react-native", async () => {
  const React = await import("react");
  const base = (await import("@/__tests__/react-native-mock")).createReactNativeMock();
  return {
    ...base,
    TouchableOpacity: ({ children, onPress }: Record<string, unknown>) =>
      React.createElement(
        "button",
        { onClick: onPress as () => void },
        children as React.ReactNode,
      ),
  };
});

vi.mock("@/i18n", () => ({
  FALLBACK_LANGUAGE: "PT",
  DICT: { PT: { ERROR_TITLE: "Something broke", ERROR_MESSAGE: "", ERROR_RETRY: "Retry" } },
}));

vi.mock("@/screens/Loading", () => ({ Loading: () => <span>loading</span> }));
const { hideSplashOnce } = vi.hoisted(() => ({ hideSplashOnce: vi.fn() }));
vi.mock("@/screens/Loading/splash", () => ({ hideSplashOnce }));

vi.mock("@/core/assistant", () => ({ subscribeAssistantActions: () => () => {} }));
vi.mock("@/contexts/app-state/AppStateProvider", () => ({
  useAppStateStatus: () => "active",
  useIsBackgrounded: () => false,
}));

const { services } = vi.hoisted(() => ({ services: [] as ReturnType<typeof fakeService>[] }));

vi.mock("@/core/player", async () => {
  const store = <T,>(snapshot: T) => ({
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
  });
  return {
    // A fresh service per mount, as after a real `destroy()`.
    playerService: () => services.at(-1),
    playerStore: store({ isPlaying: false, playbackState: "idle", isInitialized: false, syncing: false }),
    stationStore: store({}),
    progressStore: store({ progressMs: null, progressAt: 0, progressRunning: false, showProgress: false }),
  };
});

function fakeService(setupPlayer: () => Promise<void>) {
  return {
    setupPlayer,
    setAppActive: vi.fn(),
    destroy: vi.fn(() => Promise.resolve()),
    isReady: false,
  };
}

describe("PlayerProvider initialization failure", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    services.length = 0;
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    errorSpy.mockRestore();
  });

  it("shows the retryable error screen instead of loading forever", async () => {
    services.push(fakeService(() => Promise.reject(new Error("storage unavailable"))));
    render(
      <ErrorBoundary>
        <PlayerProvider>
          <span>app</span>
        </PlayerProvider>
      </ErrorBoundary>,
    );

    expect(await screen.findByText("Something broke")).toBeTruthy();
    expect(screen.queryByText("loading")).toBeNull();
    expect(hideSplashOnce).toHaveBeenCalled();
    expect(services[0].destroy).toHaveBeenCalled();

    // Retry mounts a fresh provider, which sets up a new service.
    const pendingSetup = vi.fn(() => new Promise<void>(() => {}));
    const retried = fakeService(pendingSetup);
    services.push(retried);
    fireEvent.click(screen.getByText("Retry"));

    expect(await screen.findByText("loading")).toBeTruthy();
    expect(pendingSetup).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Something broke")).toBeNull();
  });
});
