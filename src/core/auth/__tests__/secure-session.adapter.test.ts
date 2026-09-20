import { beforeEach, describe, expect, it, vi } from "vitest";

import { SecureSessionStore } from "@/core/auth/adapters/secure-session.adapter";
import type { StoredSession } from "@/core/auth/ports";
import type { User } from "@/core/domain/user";

const memory = new Map<string, string>();
const secure = new Map<string, string>();
let secureAvailable = true;

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      memory.delete(key);
    }),
  },
}));

vi.mock("expo-secure-store", () => ({
  isAvailableAsync: vi.fn(async () => secureAvailable),
  getItemAsync: vi.fn(async (key: string) => secure.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secure.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secure.delete(key);
  }),
}));

const USER = { handle: "haru", username: "haru", avatarUrl: "" } as User;
const SESSION: StoredSession = { sessionToken: "tok-1", user: USER };
const TOKEN_KEY = "auth.sessionToken";
const USER_KEY = "auth.sessionUser";
const LEGACY_KEY = "auth.session";

describe("SecureSessionStore", () => {
  beforeEach(() => {
    memory.clear();
    secure.clear();
    secureAvailable = true;
  });

  it("keeps the token in secure storage and the projection in async storage", async () => {
    await new SecureSessionStore().save(SESSION);

    expect(secure.get(TOKEN_KEY)).toBe("tok-1");
    expect(memory.get(USER_KEY)).toContain("haru");
    expect(memory.has(LEGACY_KEY)).toBe(false);
  });

  it("round-trips a saved session", async () => {
    const store = new SecureSessionStore();
    await store.save(SESSION);

    expect(await store.load()).toEqual(SESSION);
  });

  it("migrates a legacy plaintext blob into the keychain", async () => {
    memory.set(LEGACY_KEY, JSON.stringify(SESSION));

    const loaded = await new SecureSessionStore().load();

    expect(loaded).toEqual(SESSION);
    expect(secure.get(TOKEN_KEY)).toBe("tok-1");
    expect(memory.has(LEGACY_KEY)).toBe(false);
  });

  it("clears the token and the projection", async () => {
    const store = new SecureSessionStore();
    await store.save(SESSION);

    await store.clear();

    expect(await store.load()).toBeNull();
    expect(secure.size).toBe(0);
  });

  it("degrades to the plain blob when no secure store exists", async () => {
    secureAvailable = false;
    const store = new SecureSessionStore();

    await store.save(SESSION);
    expect(memory.get(LEGACY_KEY)).toContain("tok-1");

    // Legacy storage is not migrated away when it is the active format.
    expect(await store.load()).toEqual(SESSION);
    expect(memory.has(LEGACY_KEY)).toBe(true);
  });

  it("ignores an orphan token with no user projection", async () => {
    secure.set(TOKEN_KEY, "tok-1");

    expect(await new SecureSessionStore().load()).toBeNull();
  });
});
