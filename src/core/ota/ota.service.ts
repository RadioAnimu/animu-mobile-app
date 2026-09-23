import { Platform } from "react-native";
import * as Application from "expo-application";
import { fetch } from "expo/fetch";
import hotUpdate from "react-native-ota-hot-update";
import ReactNativeBlobUtil from "react-native-blob-util";

import {
  OTA_MANIFEST_URL,
  OTA_MAX_BUNDLE_VERSIONS,
} from "@/constants/ota";

declare const __DEV__: boolean | undefined;

/** `true` in the dev-client / Metro workflow, where OTA is not applicable. */
export const isOtaSupported = (): boolean =>
  typeof __DEV__ !== "undefined" ? !__DEV__ : false;

/** The manifest published alongside each bundle release. */
export interface OtaManifest {
  /** Monotonic integer. Compare against {@link getCurrentOtaVersion}. */
  version: number;
  /**
   * Native runtime the bundle was built against. A bundle must never load on a
   * binary with a different runtime — the JS would call native APIs that may
   * not exist. One guard per platform because the native build numbers differ.
   */
  iosRuntimeVersion?: string;
  androidRuntimeVersion?: string;
  downloadIosUrl?: string;
  downloadAndroidUrl?: string;
  /** Human-readable release notes, optional. */
  notes?: string;
}

export type OtaCheckResult =
  | { status: "unsupported" }
  | { status: "up-to-date"; version: number }
  | { status: "incompatible"; version: number }
  | {
      status: "available";
      version: number;
      url: string;
      notes?: string;
    }
  | { status: "error"; error: unknown };

export type OtaDownloadResult =
  | { status: "installed"; version: number }
  | { status: "error"; error: unknown };

/**
 * Identity of the native binary currently running. The version alone is not
 * enough: shipping a new build with the same marketing version but different
 * native code must invalidate older JS bundles, so the native build number is
 * part of the key (iOS `CFBundleVersion`, Android `versionCode`).
 */
export function getRuntimeVersion(): string {
  const version = Application.nativeApplicationVersion ?? "0";
  const build = Application.nativeBuildVersion ?? "0";
  return `${version}+${build}`;
}

/** Numeric version of the bundle currently running (0 = embedded bundle). */
export function getCurrentOtaVersion(): Promise<number> {
  return hotUpdate.getCurrentVersion();
}

async function fetchManifest(): Promise<OtaManifest | null> {
  // The release asset is served through GitHub's CDN, which caches
  // aggressively. A cache-busting query keeps a fresh publish visible without
  // waiting for the CDN TTL to expire.
  const response = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) return null;
  return (await response.json()) as OtaManifest;
}

function expectedRuntime(manifest: OtaManifest): string | undefined {
  return Platform.OS === "ios"
    ? manifest.iosRuntimeVersion
    : manifest.androidRuntimeVersion;
}

function downloadUrl(manifest: OtaManifest): string | undefined {
  return Platform.OS === "ios"
    ? manifest.downloadIosUrl
    : manifest.downloadAndroidUrl;
}

/**
 * The manifest is attacker-capturable-origin data (a repo-wide token, a
 * polluted release asset or a typo'd origin field would otherwise become
 * arbitrary JS on every user's next launch), so the bundle URL must point at
 * THIS repository's release assets over HTTPS — the same rule the hardcoded
 * manifest URL already follows.
 */
export function isTrustedDownloadUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/RadioAnimu/animu-mobile-app/releases/download/")
    );
  } catch {
    return false;
  }
}

/**
 * Resolves whether a newer bundle is available for this binary. Never throws —
 * update checks must not break app startup — so failures come back as
 * `{ status: "error" }`.
 */
export async function checkForOtaUpdate(): Promise<OtaCheckResult> {
  if (!isOtaSupported()) return { status: "unsupported" };

  try {
    const manifest = await fetchManifest();
    if (!manifest || typeof manifest.version !== "number") {
      return { status: "up-to-date", version: await getCurrentOtaVersion() };
    }

    const current = await getCurrentOtaVersion();
    if (manifest.version <= current) {
      return { status: "up-to-date", version: current };
    }

    // The bundle targets a runtime this binary is not — refuse it rather than
    // risking a crash on a mismatched native API surface. The field is
    // REQUIRED: a manifest omitting it must never be adopted (an omission
    // would silently opt this binary into whatever the feed shipped).
    const runtime = expectedRuntime(manifest);
    if (!runtime || runtime !== getRuntimeVersion()) {
      return { status: "incompatible", version: manifest.version };
    }

    const url = downloadUrl(manifest);
    if (!url) {
      return { status: "up-to-date", version: current };
    }
    if (!isTrustedDownloadUrl(url)) {
      return { status: "incompatible", version: manifest.version };
    }

    return {
      status: "available",
      version: manifest.version,
      url,
      notes: manifest.notes,
    };
  } catch (error) {
    return { status: "error", error };
  }
}

/**
 * Hard ceiling for a staged download. The native library can silently invoke
 * neither callback on a stalled connection; without this the returned promise
 * never settles and the Settings row stays on "Downloading…" forever.
 */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * Downloads and stages a bundle. It is applied on the next cold start (or
 * immediately via {@link restartForOtaUpdate}) — never mid-session, so a live
 * show is not interrupted by a reload.
 */
export function downloadOtaUpdate(
  url: string,
  version: number,
  onProgress?: (received: number, total: number) => void,
): Promise<OtaDownloadResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (result: OtaDownloadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    timeout = setTimeout(() => {
      finish({ status: "error", error: new Error("OTA download timed out") });
    }, DOWNLOAD_TIMEOUT_MS);

    try {
      hotUpdate.downloadBundleUri(
        ReactNativeBlobUtil as never,
        url,
        version,
        {
          restartAfterInstall: false,
          maxBundleVersions: OTA_MAX_BUNDLE_VERSIONS,
          progress: (received, total) => {
            onProgress?.(Number(received), Number(total));
          },
          updateSuccess: () => finish({ status: "installed", version }),
          updateFail: (error) => finish({ status: "error", error }),
        },
      );
    } catch (error) {
      finish({ status: "error", error });
    }
  });
}

/** Reloads the JS runtime onto the bundle staged by {@link downloadOtaUpdate}. */
export function restartForOtaUpdate(): void {
  hotUpdate.resetApp();
}
