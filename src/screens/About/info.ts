import { useEffect, useState } from "react";
import * as Application from "expo-application";

import { resolveReleaseChannel, type ReleaseChannel } from "@/utils/release-channel";

export interface AppInfo {
  /** Native app version, e.g. "2.2.0". */
  appVersion: string | null;
  /** Native build number / version code. */
  buildVersion: string | null;
  /** Distribution channel. Null until resolved, so rows only show the
      honest result and never flash "Unknown" over the real value. */
  release: ReleaseChannel | null;
  applicationId: string | null;
}

/**
 * Installed-app facts for the About screen: native version/build and
 * distribution channel. Everything is read once on mount.
 */
export function useAppInfo(): AppInfo {
  const [release, setRelease] = useState<ReleaseChannel | null>(null);

  useEffect(() => {
    let cancelled = false;

    void resolveReleaseChannel().then((channel) => {
      if (!cancelled) setRelease(channel);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    release,
    applicationId: Application.applicationId,
  };
}
