import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SessionStorePort, StoredSession } from "../ports";

const STORAGE_KEY = "auth.session";

/** {@link SessionStorePort} backed by AsyncStorage. */
export class AsyncStorageSessionStore implements SessionStorePort {
  async load(): Promise<StoredSession | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredSession;
      if (!stored?.sessionToken) return null;
      return stored;
    } catch (error) {
      console.error("[SessionStore] Failed to read session:", error);
      return null;
    }
  }

  async save(session: StoredSession): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
