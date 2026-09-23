import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Application from "expo-application";

import {
  getCurrentOtaVersion,
  getRuntimeVersion,
  isOtaSupported,
} from "@/core/ota";

/** Which channel this install came from, best-effort per platform. */
export type ReleaseChannel =
  | "app-store"
  | "ad-hoc"
  | "development"
  | "simulator"
  | "enterprise"
  | "play"
  | "apk"
  | "unknown";

export interface AppInfo {
  /** Native app version, e.g. "2.2.0". */
  appVersion: string | null;
  /** Native build number / version code. */
  buildVersion: string | null;
  /** `"2.2.0+13"` — the OTA runtime the binary accepts. */
  runtimeVersion: string;
  /** Current OTA bundle number; `0` means the embedded bundle is running. */
  otaVersion: number | null;
  otaSupported: boolean;
  release: ReleaseChannel;
  applicationId: string | null;
}

async function resolveRelease(): Promise<ReleaseChannel> {
  if (Platform.OS === "ios") {
    try {
      const type = await Application.getIosApplicationReleaseTypeAsync();
      switch (type) {
        case Application.ApplicationReleaseType.APP_STORE:
          return "app-store";
        case Application.ApplicationReleaseType.AD_HOC:
          return "ad-hoc";
        case Application.ApplicationReleaseType.DEVELOPMENT:
          return "development";
        case Application.ApplicationReleaseType.SIMULATOR:
          return "simulator";
        case Application.ApplicationReleaseType.ENTERPRISE:
          return "enterprise";
        default:
          return "unknown";
      }
    } catch {
      return "unknown";
    }
  }

  // Android: the install referrer is populated by the Play Install Referrer
  // library, so a resolved, non-empty value means a Play distribution;
  // otherwise assume a sideloaded APK. Not 100% reliable (Play installs
  // without a campaign can be empty), but the best available without native
  // code.
  try {
    const referrer = await Application.getInstallReferrerAsync();
    return referrer ? "play" : "apk";
  } catch {
    return "apk";
  }
}

/**
 * Installed-app facts for the About screen: native version/build, OTA bundle
 * number, runtime and distribution channel. Everything is read once on mount.
 */
export function useAppInfo(): AppInfo {
  const otaSupported = isOtaSupported();
  const [otaVersion, setOtaVersion] = useState<number | null>(null);
  const [release, setRelease] = useState<ReleaseChannel>("unknown");

  useEffect(() => {
    let cancelled = false;

    if (otaSupported) {
      void getCurrentOtaVersion()
        .then((version) => {
          if (!cancelled) setOtaVersion(version);
        })
        .catch((error) => console.warn("[About] OTA version failed:", error));
    }

    void resolveRelease().then((channel) => {
      if (!cancelled) setRelease(channel);
    });

    return () => {
      cancelled = true;
    };
  }, [otaSupported]);

  return {
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    runtimeVersion: getRuntimeVersion(),
    otaVersion,
    otaSupported,
    release,
    applicationId: Application.applicationId,
  };
}
