// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Real provider + real hook under test ────────────────────────────────────

import {
  UserSettingsProvider,
  useUserSettings,
} from "@/contexts/user/UserSettingsProvider";
import { useCoverStorageSnapshot } from "@/hooks/useCoverStorage";
import { coverCacheRegistry } from "@/core/services/cover-cache-registry.service";
import { userSettingsService } from "@/core/services/user-settings.service";
import { DEFAULT_USER_SETTINGS } from "@/constants/settings";
import {
  NavigationContext,
  type NavigationProp,
} from "@react-navigation/core";

vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

// ── Fake drawer navigation ──────────────────────────────────────────────────

type Listener = () => void;

function makeNavigation() {
  const focusListeners = new Set<Listener>();
  const blurListeners = new Set<Listener>();
  let focused = false;
  return {
    isFocused: () => focused,
    focus() {
      focused = true;
      for (const l of [...focusListeners]) l();
    },
    blur() {
      focused = false;
      for (const l of [...blurListeners]) l();
    },
    addListener(event: "focus" | "blur", listener: Listener) {
      (event === "focus" ? focusListeners : blurListeners).add(listener);
      return () => {
        (event === "focus" ? focusListeners : blurListeners).delete(listener);
      };
    },
  };
}

// ── Service mocks ───────────────────────────────────────────────────────────

const { getCachePathAsync, files, settingsStore } = vi.hoisted(() => ({
  getCachePathAsync: vi.fn<(key: string) => Promise<string | null>>(),
  files: new Map<string, { exists: boolean; size: number }>(),
  settingsStore: new Map<string, string>(),
}));

vi.mock("expo-image", () => ({
  Image: {
    getCachePathAsync: (key: string) => getCachePathAsync(key),
    clearDiskCache: vi.fn(async () => {}),
    clearMemoryCache: vi.fn(async () => {}),
  },
}));

vi.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    exists: boolean;
    size: number;
    constructor(uri: string) {
      this.uri = uri;
      this.exists = files.get(uri)?.exists ?? false;
      this.size = files.get(uri)?.size ?? 0;
    }
    delete(): void {
      files.set(this.uri, { exists: false, size: 0 });
    }
  },
}));

vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      getItem: async (key: string) => settingsStore.get(key) ?? null,
      setItem: async (key: string, value: string) =>
        void settingsStore.set(key, value),
      removeItem: async (key: string) => void settingsStore.delete(key),
    },
  };
});

vi.mock("@/core/player", () => ({
  playerService: () => ({
    updateLiveStreamLifecycle: vi.fn(),
    setVisualizerEnabled: vi.fn(),
  }),
}));

vi.mock("@react-navigation/native", async () => {
  const core = await import("@react-navigation/core");
  return { useFocusEffect: core.useFocusEffect };
});

const LIVE = "https://cdn/live1.jpg";
const url = (u: string) => `file:///data/cache/${encodeURIComponent(u)}`;

async function seedRegistry(entries: [string, number][]) {
  await coverCacheRegistry.clear();
  files.clear();
  for (const [u, size] of entries) {
    coverCacheRegistry.tag(u, "live");
    files.set(url(u), { exists: true, size });
  }
  getCachePathAsync.mockImplementation(async (key) =>
    files.get(url(key)) ? url(key) : null,
  );
  await coverCacheRegistry.load();
}

/** Minimal settings consumer with imperative update access. */
function SettingsProbe({
  onReady,
}: {
  onReady: (ctx: {
    settings: ReturnType<typeof useUserSettings>["settings"];
    updateSettings: ReturnType<typeof useUserSettings>["updateSettings"];
  }) => void;
}) {
  const { settings, updateSettings } = useUserSettings();
  useEffect(() => {
    onReady({ settings, updateSettings });
  });
  return null;
}

interface CardState {
  total: number | null;
  measuring: boolean;
}

/** A "storage card" that reports its render state; survives blur like a drawer screen. */
function FakeCard({
  report,
  onFreed,
}: {
  report: (s: CardState) => void;
  onFreed?: (freed: number) => void;
}) {
  const { snapshot, measuring } = useCoverStorageSnapshot({ onFreed });
  useEffect(() => {
    report({
      total: snapshot ? snapshot.totalBytes : null,
      measuring,
    });
  });
  return null;
}

describe("useCoverStorageSnapshot across drawer focus/blur", () => {
  let navCard: ReturnType<typeof makeNavigation>;
  let cardState: CardState;
  let probe: {
    settings: ReturnType<typeof useUserSettings>["settings"];
    updateSettings: ReturnType<typeof useUserSettings>["updateSettings"];
  } | null;

  function mount(onFreed?: (freed: number) => void) {
    return render(
      <UserSettingsProvider>
        <NavigationContext.Provider
          value={navCard as unknown as NavigationProp<Record<string, never>>}
        >
          <FakeCard
            onFreed={onFreed}
            report={(s) => {
              cardState = s;
            }}
          />
        </NavigationContext.Provider>
        <SettingsProbe
          onReady={(ctx) => {
            probe = ctx;
          }}
        />
      </UserSettingsProvider>,
    );
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    settingsStore.clear();
    // Module singletons survive across tests: reset the service's in-memory
    // settings and the storage service's work chain.
    (
      userSettingsService as unknown as { settings: typeof DEFAULT_USER_SETTINGS }
    ).settings = DEFAULT_USER_SETTINGS;
    navCard = makeNavigation();
    cardState = { total: null, measuring: true };
    probe = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("measures on first focus and reports the total", async () => {
    await seedRegistry([[LIVE, 500]]);
    mount();
    navCard.focus();
    await act(async () => {});
    expect(cardState).toMatchObject({ total: 500, measuring: false });
  });

  it("updates while focused when the limit changes", async () => {
    await seedRegistry([
      [LIVE, 200],
      ["https://cdn/live2.jpg", 400],
    ]);
    mount();
    navCard.focus();
    await act(async () => {});
    expect(cardState).toMatchObject({ total: 600, measuring: false });

    await act(async () => {
      await probe!.updateSettings({ coverCacheLimitBytes: 300 });
    });
    // Trim evicts the oldest (200 B) while keeping the newest → 400.
    expect(cardState).toMatchObject({ total: 400, measuring: false });
  });

  it("blurred card: limit change skips its measure; refocus re-measures", async () => {
    await seedRegistry([[LIVE, 500]]);
    mount();
    navCard.focus();
    await act(async () => {});
    expect(cardState).toMatchObject({ total: 500, measuring: false });

    navCard.blur();

    await act(async () => {
      await probe!.updateSettings({ coverCacheLimitBytes: 100 });
    });

    // The blurred instance must not measure (no stuck "measuring" state);
    // its numbers simply stay stale while nobody can see them.
    expect(cardState).toEqual({ total: 500, measuring: false });

    navCard.focus();
    await act(async () => {});
    // limit 100 < 500 but the newest entry is never evicted.
    expect(cardState).toEqual({ total: 500, measuring: false });
  });

  it("blurred instance stays silent while another screen drives the change", async () => {
    await seedRegistry([
      [LIVE, 200],
      ["https://cdn/live2.jpg", 400],
    ]);
    const freedEvents: number[] = [];
    mount((freed) => freedEvents.push(freed));
    navCard.focus();
    await act(async () => {});
    expect(cardState).toMatchObject({ total: 600, measuring: false });

    // The user is on the OTHER screen (this one blurred) and shrinks the
    // limit there: the trim evicts the oldest → 600 → 400. The focused
    // screen reports that reclaim; this blurred instance must not fire a
    // second (spurious) toast.
    navCard.blur();
    await act(async () => {
      await probe!.updateSettings({ coverCacheLimitBytes: 300 });
    });

    expect(freedEvents).toEqual([]);
  });
});
