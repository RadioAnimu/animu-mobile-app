import * as Application from "expo-application";
import Constants from "expo-constants";

/** The installed build's version; the app config's where there is no native one (web). */
export const APP_VERSION: string | null =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null;
