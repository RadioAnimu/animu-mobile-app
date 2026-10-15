import importlib.util
import pathlib
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "ios_archive", pathlib.Path(__file__).parents[1] / "validate-ios-archive.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ArchiveValidation(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = pathlib.Path(self.temp.name)
        self.app = self.archive / "Products/Applications/Animu.app"
        self.app.mkdir(parents=True)
        self.config = {
            "expo": {
                "version": "3.0.0",
                "ios": {
                    "bundleIdentifier": "com.nessjs.animu",
                    "buildNumber": "6",
                    "supportsTablet": False,
                },
            }
        }
        self.info = {
            "CFBundleIdentifier": "com.nessjs.animu",
            "CFBundleShortVersionString": "3.0.0",
            "CFBundleVersion": "6",
            "DTSDKName": "iphoneos26.0",
            "DTPlatformName": "iphoneos",
            "CFBundleSupportedPlatforms": ["iPhoneOS"],
            "MinimumOSVersion": "16.4",
            "UIDeviceFamily": [1],
            "UIBackgroundModes": ["audio"],
            "ITSAppUsesNonExemptEncryption": False,
            "NSPhotoLibraryAddUsageDescription": "Save stats card",
        }
        self.manifest = {
            "NSPrivacyTracking": False,
            "NSPrivacyAccessedAPITypes": [
                {
                    "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
                    "NSPrivacyAccessedAPITypeReasons": ["CA92.1"],
                }
            ],
        }

    def run_validation(self):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(self.info))
        manifest = self.app / "PrivacyInfo.xcprivacy"
        manifest.write_bytes(plistlib.dumps(self.manifest))
        return validator.validate(self.archive, self.config)

    def assert_rejected(self, info_key, value):
        old = self.info.get(info_key)
        self.info[info_key] = value
        try:
            with self.assertRaises(ValueError):
                self.run_validation()
        finally:
            if old is None:
                del self.info[info_key]
            else:
                self.info[info_key] = old

    def test_accepts_a_device_archive_without_claiming_signing_or_upload(self):
        result = self.run_validation()
        self.assertFalse(result["distributionSigningValidated"])
        self.assertFalse(result["storeUploadValidated"])
        self.assertEqual(len(result["privacyManifests"]), 1)

    def test_rejects_a_stale_version_simulator_build_or_old_sdk(self):
        for key, value in [
            ("CFBundleVersion", "5"),
            ("DTSDKName", "iphoneos18.5"),
            ("MinimumOSVersion", "12.5"),
            ("DTPlatformName", "iphonesimulator"),
            ("UIDeviceFamily", [1, 2]),
        ]:
            with self.subTest(key=key):
                self.assert_rejected(key, value)

    def test_rejects_unexpected_permissions_or_insecure_networking(self):
        self.assert_rejected("NSMicrophoneUsageDescription", "unexpected")
        self.assert_rejected("NSAppTransportSecurity", {"NSAllowsArbitraryLoads": True})

    def test_rejects_tracking_and_required_reason_apis_without_reasons(self):
        self.manifest["NSPrivacyTracking"] = True
        with self.assertRaises(ValueError):
            self.run_validation()
        self.manifest["NSPrivacyTracking"] = False
        api = self.manifest["NSPrivacyAccessedAPITypes"][0]
        api["NSPrivacyAccessedAPITypeReasons"] = []
        with self.assertRaises(ValueError):
            self.run_validation()


if __name__ == "__main__":
    unittest.main()
