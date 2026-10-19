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
const ALLOWED_URL_SCHEMES = new Set(["https:", "market:", "itms-apps:", "altstore:"]);

/** The store list lookup gives this long before the user taps. */
const STORE_LINKS_TIMEOUT_MS = 5000;

function isAllowedUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw) return false;
  const scheme = raw.slice(0, raw.indexOf(":") + 1).toLowerCase();
  return ALLOWED_URL_SCHEMES.has(scheme);
}

/**
 * An entry is only mine to use when both fields read like a store listing:
 * a name, and either a sanctioned URL or an explicit null (not listed). A
 * broken URL is not "not listed", so it must not hide the bundled link.
 */
function sanitizeStoreEntry(raw: unknown): StoreLink | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { name, url } = raw as { name?: unknown; url?: unknown };
  if (typeof name !== "string" || !name) return null;
  if (url !== null && !isAllowedUrl(url)) return null;
  return { name, url };
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
 * slow (aborted after five seconds), answers an HTTP error or an invalid
 * shape.
 */
async function fetchStoreLinks(): Promise<StoreLinks> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORE_LINKS_TIMEOUT_MS);
  try {
    const response = await fetch(API.STORE_LINKS_URL, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`store list HTTP ${response.status}`);
    return mergeStoreLinks(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * One fetch shared by concurrent callers. A good answer is cached for the
 * session; a failed one is not, so the next caller (Settings reopened after
 * the device came back online) asks again.
 */
let linksPromise: Promise<StoreLinks> | null = null;

export function getStoreLinks(): Promise<StoreLinks> {
  linksPromise ??= fetchStoreLinks().catch((error) => {
    console.warn("[StoreReview] store list failed:", error);
    linksPromise = null;
    return DEFAULT_STORE_LINKS;
  });
  return linksPromise;
}
