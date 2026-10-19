import { Platform } from "react-native";
import * as Application from "expo-application";

/** Which channel this install came from, best-effort per platform. */
export type ReleaseChannel =
  | "app-store"
  | "ad-hoc"
  | "development"
  | "simulator"
  | "enterprise"
  | "play"
  | "unknown";

/** Best-effort distribution channel; one native read per call. */
export async function resolveReleaseChannel(): Promise<ReleaseChannel> {
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
  // library, so a resolved, non-empty value means a Play distribution. An
  // empty result proves nothing (Play installs without a campaign are empty
  // too), and expo-application exposes no installer-package API — without a
  // reliable source the honest label is "Unknown" rather than claiming a
  // sideloaded APK.
  try {
    const referrer = await Application.getInstallReferrerAsync();
    return referrer ? "play" : "unknown";
  } catch {
    return "unknown";
  }
}
