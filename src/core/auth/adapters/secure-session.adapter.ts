import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { SessionStorePort, StoredSession } from "@/core/auth/ports";
import type { User } from "@/core/domain/user";

/** Keychain/Keystore key for the session token (the only sensitive part). */
const TOKEN_KEY = "auth.sessionToken";
/** Non-sensitive user projection (name, avatar, provider) — plain storage. */
const USER_KEY = "auth.sessionUser";
/** Pre-SecureStore plaintext blob (`{ sessionToken, user }`), migrated on read. */
const LEGACY_KEY = "auth.session";

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
 * persisted in plaintext by older builds is migrated on first read, and
 * platforms without a secure store (e.g. web) degrade to the old single-blob
 * layout so the app still works.
 */
export class SecureSessionStore implements SessionStorePort {
  /** `null` until probed. */
  private secureAvailable: boolean | null = null;

  private async canUseSecureStore(): Promise<boolean> {
    if (this.secureAvailable != null) return this.secureAvailable;
    try {
      this.secureAvailable = await SecureStore.isAvailableAsync();
    } catch (error) {
      console.warn(
        "[SessionStore] SecureStore unavailable, falling back to plain storage:",
        error,
      );
      this.secureAvailable = false;
    }
    return this.secureAvailable;
  }

  async load(): Promise<StoredSession | null> {
    try {
      const [token, userRaw] = await Promise.all([
        this.readToken(),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token) {
        const user = parseUser(userRaw);
        if (user) return { sessionToken: token, user };
        // Token without its projection (interrupted write / corruption):
        // treat as no session rather than surfacing a half-built user.
      }

      // Migrate a legacy plaintext blob from an older build — only when we
      // can actually upgrade it to the keychain. Without a secure store the
      // legacy blob IS the storage format, so it must be left in place.
      const legacy = parseBlob(await AsyncStorage.getItem(LEGACY_KEY));
      if (legacy) {
        if (await this.canUseSecureStore()) {
          await this.save(legacy);
          await AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
        }
        return legacy;
      }

      return null;
    } catch (error) {
      console.error("[SessionStore] Failed to read session:", error);
      return null;
    }
  }

  async save(session: StoredSession): Promise<void> {
    if (await this.canUseSecureStore()) {
      // Projection first: a crash between the two writes must not leave an
      // orphan token with no user (which `load` would reject anyway).
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(session.user));
      await SecureStore.setItemAsync(TOKEN_KEY, session.sessionToken);
      return;
    }
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      AsyncStorage.removeItem(USER_KEY).catch(() => {}),
      AsyncStorage.removeItem(LEGACY_KEY).catch(() => {}),
    ]);
  }

  private async readToken(): Promise<string | null> {
    if (!(await this.canUseSecureStore())) return null;
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("[SessionStore] Failed to read token:", error);
      return null;
    }
  }
}
