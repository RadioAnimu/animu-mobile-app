import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { getLocales } from "expo-localization";
import Constants from "expo-constants";
import { clientUserAgent, type ClientInfo } from "animu-api";
import { setUserAgent } from "./player.config";

/**
 * Single source of truth for "who is the client".
 *
 * Everything here is collected once at startup and handed to the API package
 * (`clientInfo`), which turns it into `X-Client-*` headers and the structured
 * User-Agent. The stream inherits the same User-Agent via `player.config`
 * (listener maps display it, so it must carry the platform/model).
 *
 * This module touches native modules (`react-native`, `expo-device`, …) and is
 * therefore intentionally kept out of `player.config`/`artwork`, which unit
 * tests load in plain node.
 */

const platform: ClientInfo["platform"] =
  Platform.OS === "ios"
    ? "ios"
    : Platform.OS === "android"
      ? "android"
      : Platform.OS === "web"
        ? "web"
        : "other";

/**
 * `Device.osName` is unreliable on Android (some OEMs set it to a build
 * fingerprint), so the display name comes from `Platform.OS` and the version
 * from `Device.osVersion` (human-readable) with a `Platform.Version` fallback.
 */
const os =
  platform === "ios" ? "iOS" : platform === "android" ? "Android" : "Web";
const osVersion = String(Device.osVersion ?? Platform.Version ?? "");

/** Friendly model ("iPhone 17 Pro Max", "moto g7"), with sane fallbacks. */
const model = Device.modelName ?? Device.modelId ?? Device.brand ?? undefined;

const deviceType =
  Device.deviceType === Device.DeviceType.TABLET
    ? "tablet"
    : Device.deviceType === Device.DeviceType.PHONE
      ? "phone"
      : platform === "web"
        ? "web"
        : "unknown";

const appVersion =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0";
const appBuild =
  Application.nativeBuildVersion ??
  String(
    platform === "ios"
      ? Constants.expoConfig?.ios?.buildNumber ?? ""
      : Constants.expoConfig?.android?.versionCode ?? "",
  );

const locale = getLocales()[0];

export const CLIENT_INFO: ClientInfo = {
  app: "animu-mobile",
  platform,
  version: appVersion,
  build: appBuild,
  os,
  osVersion,
  model,
  manufacturer: Device.manufacturer ?? undefined,
  deviceType,
  language: locale?.languageTag ?? undefined,
  region: locale?.regionCode ?? undefined,
  emulator: Device.isDevice === false,
};

/** `RadioAnimu/2.1.0 (iOS 27; iPhone 17 Pro Max; pt-BR; build 3)` */
export const USER_AGENT = clientUserAgent(CLIENT_INFO) ?? "animu-api";

// The stream request is built by the native audio stack from `CONFIG`, which
// stays native-free; inject the structured UA into it at startup.
setUserAgent(USER_AGENT);
