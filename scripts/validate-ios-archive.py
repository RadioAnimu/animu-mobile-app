"""Checks an unsigned iOS device archive against App Store upload requirements.

usage: validate-ios-archive.py <archive.xcarchive> <app.json>

SDK and deployment-target floors follow Apple's upcoming requirements
(https://developer.apple.com/news/upcoming-requirements/): built with the
iOS 26 SDK since April 28, 2026; targeting iOS 13 or later since
September 9, 2026. Distribution signing and upload are not checked here.
"""
import json
import pathlib
import plistlib
import re
import sys


def validate(archive, config):
    apps = list(pathlib.Path(archive).glob("Products/Applications/*.app"))
    if len(apps) != 1:
        raise ValueError("Archive must contain one application")
    app = apps[0]
    with (app / "Info.plist").open("rb") as stream:
        info = plistlib.load(stream)
    expo = config["expo"]
    expected = {
        "CFBundleIdentifier": expo["ios"]["bundleIdentifier"],
        "CFBundleShortVersionString": expo["version"],
        "CFBundleVersion": expo["ios"]["buildNumber"],
    }
    if any(str(info.get(key, "")) != value for key, value in expected.items()):
        raise ValueError("Archive identifiers or versions differ from app.json")
    sdk = re.fullmatch(r"iphoneos(\d+)(?:\.\d+)*", info.get("DTSDKName", ""))
    if not sdk or int(sdk.group(1)) < 26 or info.get("DTPlatformName") != "iphoneos":
        raise ValueError("Archive must use the current required device SDK (iOS 26+)")
    minimum = str(info.get("MinimumOSVersion", "")).split(".")[0]
    if not minimum.isdigit() or int(minimum) < 13:
        raise ValueError("Archive deployment target is below the current iOS 13 minimum")
    if info.get("CFBundleSupportedPlatforms") != ["iPhoneOS"]:
        raise ValueError("A simulator archive is not a device build")
    if not expo["ios"].get("supportsTablet", False) and info.get("UIDeviceFamily") != [1]:
        raise ValueError("Device family differs from the iPhone-only configuration")
    if "audio" not in info.get("UIBackgroundModes", []):
        raise ValueError("Background audio mode missing")
    if info.get("NSAppTransportSecurity", {}).get("NSAllowsArbitraryLoads", False):
        raise ValueError("Release archive permits arbitrary insecure network loads")
    blocked = [
        "NSMicrophoneUsageDescription", "NSCameraUsageDescription",
        "NSLocationAlwaysUsageDescription", "NSLocationWhenInUseUsageDescription",
        "NSUserTrackingUsageDescription", "NSPhotoLibraryUsageDescription",
        "NSFaceIDUsageDescription",
    ]
    if any(key in info for key in blocked):
        raise ValueError("Unexpected sensitive permission in release archive")
    if not info.get("NSPhotoLibraryAddUsageDescription"):
        raise ValueError("Stats-card photo-add disclosure missing")
    if info.get("ITSAppUsesNonExemptEncryption") is not False:
        raise ValueError("Archive encryption declaration differs from configuration")
    manifests = []
    for file in sorted(app.rglob("PrivacyInfo.xcprivacy")):
        with file.open("rb") as stream:
            manifest = plistlib.load(stream)
        if manifest.get("NSPrivacyTracking", False) or manifest.get("NSPrivacyTrackingDomains", []):
            raise ValueError("Unexpected tracking declared by a native dependency")
        apis = manifest.get("NSPrivacyAccessedAPITypes", [])
        for api in apis:
            reasons = api.get("NSPrivacyAccessedAPITypeReasons")
            if not api.get("NSPrivacyAccessedAPIType") or not reasons:
                raise ValueError("Native required-reason API lacks a declaration")
        manifests.append({"path": str(file.relative_to(app)), "accessedAPIs": apis})
    if not manifests:
        raise ValueError("Privacy manifests missing from archive")
    return {**expected, "sdk": info["DTSDKName"], "privacyManifests": manifests,
            "distributionSigningValidated": False, "storeUploadValidated": False}


if __name__ == "__main__":
    with open(sys.argv[2], encoding="utf8") as source:
        config = json.load(source)
    print(json.dumps(validate(sys.argv[1], config), indent=2))
