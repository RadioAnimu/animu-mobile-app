import * as Application from "expo-application";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { API } from "@/api";

/** Which store this install came from — one row drives all the copies. */
export type StoreId = "play" | "app-store" | "altstore" | "apk";

/** A store's display name and its review-page URL, null when not listed. */
export interface StoreLink {
  readonly name: string;
  readonly url: string | null;
}

export type StoreLinks = Readonly<Record<StoreId, StoreLink>>;

/**
 * Bundled copy of the store list endpoint, used unchanged while the fetch
 * fails, is slow or answers with a shape we can't trust.
 */
export const DEFAULT_STORE_LINKS: StoreLinks = {
  play: {
    name: "Google Play",
    url: "https://play.google.com/store/apps/details?id=com.nessjs.animu&showAllReviews=true",
  },
  "app-store": { name: "App Store", url: null },
  altstore: {
    name: "AltStore",
    url: "altstore://source?url=https://radioanimu.github.io/animu-mobile-app/source.json",
  },
  apk: {
    name: "Google Play",
    url: "https://play.google.com/store/apps/details?id=com.nessjs.animu&showAllReviews=true",
  },
};

/** Schemes a store link may use — anything else came in broken. */
const ALLOWED_URL_SCHEMES = ["https:", "market:", "itms-apps:", "altstore:"];

/** The store list lookup gives this long before the user taps. */
const STORE_LINKS_TIMEOUT_MS = 5000;

function sanitizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const scheme = raw.slice(0, raw.indexOf(":") + 1).toLowerCase();
  return ALLOWED_URL_SCHEMES.includes(scheme) ? raw : null;
}

/** An entry is only mine to use when both fields read like a store listing. */
function sanitizeStoreEntry(raw: unknown): StoreLink | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, url } = raw as { name?: unknown; url?: unknown };
  if (typeof name !== "string" || !name) return null;
  return { name, url: sanitizeUrl(url) };
}

/**
 * Valid remote stores laid over the bundled ones, per store: an entry that
 * fails validation leaves the default in place.
 */
function mergeStoreLinks(payload: unknown): StoreLinks {
  const stores = (payload as { stores?: unknown } | null)?.stores;
  if (typeof stores !== "object" || stores === null) {
    throw new Error("Unexpected store-links shape");
  }
  const merged = { ...DEFAULT_STORE_LINKS };
  for (const id of Object.keys(DEFAULT_STORE_LINKS) as StoreId[]) {
    const entry = sanitizeStoreEntry(
      (stores as Record<string, unknown>)[id],
    );
    if (entry) merged[id] = entry;
  }
  return merged;
}

/**
 * The store list, or the bundled defaults when the endpoint is unreachable,
 * slow (aborted after five seconds) or answers an invalid shape.
 */
async function fetchStoreLinks(): Promise<StoreLinks> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORE_LINKS_TIMEOUT_MS);
  try {
    const response = await fetch(API.STORE_LINKS_URL, {
      signal: controller.signal,
    });
    return mergeStoreLinks(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

/** One fetch shared by concurrent callers, cached for the session. */
let linksPromise: Promise<StoreLinks> | null = null;

export function getStoreLinks(): Promise<StoreLinks> {
  linksPromise ??= fetchStoreLinks().catch((error) => {
      console.warn("[StoreReview] store list failed:", error);
      return DEFAULT_STORE_LINKS;
    });
  return linksPromise;
}

/**
 * Where this install came from, best-effort from expo-application: the
 * release type on iOS (developer-signed builds are AltStore/SideStore
 * sideloads) and the Play install referrer on Android.
 */
export async function resolveInstallSource(): Promise<StoreId> {
  if (Platform.OS === "ios") {
    try {
      const type = await Application.getIosApplicationReleaseTypeAsync();
      switch (type) {
        case Application.ApplicationReleaseType.AD_HOC:
        case Application.ApplicationReleaseType.DEVELOPMENT:
        case Application.ApplicationReleaseType.ENTERPRISE:
          return "altstore";
        default:
          return "app-store";
      }
    } catch {
      return "app-store";
    }
  }

  // Only the Play Install Referrer library fills the referrer, so a
  // non-empty one means Play; anything else is treated as a hand-installed
  // APK (whose link points at the Play listing by default anyway).
  try {
    const referrer = await Application.getInstallReferrerAsync();
    return referrer ? "play" : "apk";
  } catch {
    return "apk";
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
