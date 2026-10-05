import AsyncStorage from "@react-native-async-storage/async-storage";
import type * as SecureStoreTypes from "expo-secure-store";
import type { SessionStorePort, StoredSession } from "@/core/auth/ports";
import type { User } from "@/core/domain/user";

/** Keychain/Keystore key for the session token (the only sensitive part). */
const TOKEN_KEY = "auth.sessionToken";
/** Non-sensitive user projection (name, avatar, provider) — plain storage. */
const USER_KEY = "auth.sessionUser";
/** Pre-SecureStore plaintext blob (`{ sessionToken, user }`), migrated on read. */
const LEGACY_KEY = "auth.session";
/** Wall-clock mark that a server-provider browser flow is in flight. */
const PENDING_KEY = "auth.serverFlowPendingAt";
/** A marker older than this can never adopt a cold-start bounce. */
const PENDING_TTL_MS = 10 * 60_000;

function pendingFresh(raw: string | null, now: number): boolean {
  if (!raw) return false;
  const armedAt = Number(raw);
  return Number.isFinite(armedAt) && armedAt > 0 && now >= armedAt && now - armedAt <= PENDING_TTL_MS;
}

function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as User) : null;
  } catch {
    return null;
  }
}

function parseBlob(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.sessionToken ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * {@link SessionStorePort} backed by the platform keychain/keystore.
 *
 * Only the token is sensitive: it is written to `expo-secure-store`
 * (iOS Keychain / Android Keystore-backed), while the display projection
 * (username, avatar, provider) lives in AsyncStorage. A session previously
 * persisted in plaintext by older builds is migrated on first secure read.
 * If secure storage is unavailable, saving fails instead of persisting secrets
 * in plaintext. Anonymous playback remains available.
 *
 * The native module is resolved lazily (first use, not import): it evaluates
 * its native constants eagerly. Missing native support must not crash launch;
 * it prevents session persistence instead.
 */
export class SecureSessionStore implements SessionStorePort {
  /** `undefined` = not resolved yet; `null` = native module unavailable. */
  private secureStore: typeof SecureStoreTypes | null | undefined;
  /** Only a POSITIVE availability probe is cached (see `usableSecureStore`). */
  private secureAvailable = false;

  private async resolveSecureStore(): Promise<typeof SecureStoreTypes | null> {
    if (this.secureStore !== undefined) return this.secureStore;
    try {
      this.secureStore = await import("expo-secure-store");
    } catch (error) {
      console.warn(
        "[SessionStore] SecureStore native module unavailable — cannot persist sessions:",
        error,
      );
      this.secureStore = null;
    }
    return this.secureStore;
  }

  private async usableSecureStore(): Promise<typeof SecureStoreTypes | null> {
    const store = await this.resolveSecureStore();
    if (!store) return null;
    if (this.secureAvailable) return store;
    try {
      this.secureAvailable = await store.isAvailableAsync();
    } catch (error) {
      console.warn(
        "[SessionStore] SecureStore unavailable; cannot persist sessions:",
        error,
      );
      this.secureAvailable = false;
    }
    // A false may be transient (keychain not ready during very early
    // startup), so it is NOT cached — a later call re-probes rather than
    // degrading the whole JS session on one bad probe.
    return this.secureAvailable ? store : null;
  }

  async load(): Promise<StoredSession | null> {
    try {
      const [token, userRaw] = await Promise.all([
        this.readToken(),
        AsyncStorage.getItem(USER_KEY),
      ]);

      const user = parseUser(userRaw);
      if (token && user) {
        // Remove plaintext tokens left by older profile projections.
        if (user.sessionToken) await this.save({ sessionToken: token, user });
        return { sessionToken: token, user: { ...user, sessionToken: token } };
      }
      // Token without its projection (interrupted write / corruption) is not
      // a usable session.

      // Migrate a legacy plaintext blob from an older build — only when we
      // can upgrade it to the keychain. Otherwise defer migration until the
      // secure store recovers; do not adopt an insecure session.
      const legacy = parseBlob(await AsyncStorage.getItem(LEGACY_KEY));
      if (legacy && await this.usableSecureStore()) {
        await this.save(legacy);
        return { ...legacy, user: { ...legacy.user, sessionToken: legacy.sessionToken } };
      }

      return null;
    } catch (error) {
      console.error("[SessionStore] Failed to read session:", error);
      return null;
    }
  }

  async save(session: StoredSession): Promise<void> {
    const store = await this.usableSecureStore();
    if (!store) {
      throw new Error("Secure session storage is unavailable; please try signing in again");
    }
    // Projection first: a crash between the two writes must not leave an
    // orphan token with no user (which `load` would reject anyway).
    const projection = { ...session.user };
    delete (projection as Partial<User>).sessionToken;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(projection));
    await store.setItemAsync(TOKEN_KEY, session.sessionToken, {
      // Device-scoped: the token must not travel to another device via an
      // unencrypted iOS backup/transfer. AFTER_FIRST_UNLOCK keeps it readable
      // once the device has been unlocked since boot — background session
      // checks still work — while excluding backup migration. The constant
      // rides the dynamically-imported namespace; a static value import
      // would eagerly evaluate native constants (see `resolveSecureStore`).
      keychainAccessible: store.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    // A previous save may have degraded to the plaintext blob (transient
    // secure-store probe failure): now that the keychain took the token,
    // erase that plaintext copy so it never outlives the session.
    await AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
  }

  async clear(): Promise<void> {
    const store = await this.usableSecureStore();
    await Promise.all([
      store ? store.deleteItemAsync(TOKEN_KEY).catch(() => {}) : Promise.resolve(),
      AsyncStorage.removeItem(USER_KEY).catch(() => {}),
      AsyncStorage.removeItem(LEGACY_KEY).catch(() => {}),
      AsyncStorage.removeItem(PENDING_KEY).catch(() => {}),
    ]);
  }

  // ─── Server-auth flow marker ───
  // Plain storage is fine for this: it is a timestamp, not a secret — its only
  // job is proving the USER initiated a browser flow recently enough for a
  // cold-start bounce to be the legit continuation of it.

  async markServerAuthPending(): Promise<void> {
    await AsyncStorage.setItem(PENDING_KEY, String(Date.now()));
  }

  async discardServerAuthPending(): Promise<void> {
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  }

  async takeServerAuthPending(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!pendingFresh(raw, Date.now())) {
        await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
        return false;
      }
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private async readToken(): Promise<string | null> {
    const store = await this.usableSecureStore();
    if (!store) return null;
    try {
      return await store.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("[SessionStore] Failed to read token:", error);
      return null;
    }
  }
}
