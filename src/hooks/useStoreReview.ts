import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { getStoreLinks, type StoreId } from "@/api/store-links";
import { resolveReleaseChannel } from "@/utils/release-channel";

/**
 * Where this install came from, mapped to the store whose link fits: iOS
 * developer-signed builds (development, ad hoc, enterprise) are AltStore /
 * SideStore sideloads; an Android install without a Play referrer is treated
 * as a hand-installed APK (whose link points at the Play listing by default).
 */
export async function resolveInstallSource(): Promise<StoreId> {
  switch (await resolveReleaseChannel()) {
    case "play":
      return "play";
    case "ad-hoc":
    case "development":
    case "enterprise":
      return "altstore";
    case "unknown":
      return Platform.OS === "ios" ? "app-store" : "apk";
    default:
      return "app-store";
  }
}

export interface StoreReview {
  /** Resolved store, or null while the lookup is still running. */
  store: StoreId | null;
  /** Store's display name, null until resolved. */
  name: string | null;
  /** Review-page URL; null when the store hasn't listed the app. */
  url: string | null;
}

/**
 * Facts for the "Rate the app" row, resolved once on mount. Everything is
 * null until both reads finish, so the row never flashes a placeholder.
 * The store list is one session-cached request (see getStoreLinks), so
 * remounts never fetch again.
 */
export function useStoreReview(): StoreReview {
  const [review, setReview] = useState<StoreReview>({
    store: null,
    name: null,
    url: null,
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([resolveInstallSource(), getStoreLinks()]).then(
      ([store, links]) => {
        if (cancelled) return;
        const link = links[store];
        setReview({ store, name: link?.name ?? null, url: link?.url ?? null });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return review;
}
