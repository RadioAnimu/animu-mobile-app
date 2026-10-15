import importlib.util
import pathlib
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ios_archive", pathlib.Path(__file__).parents[1] / "validate-ios-archive.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ArchiveValidation(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.archive = pathlib.Path(self.temp.name)
        self.app = self.archive / "Products/Applications/Animu.app"
        self.app.mkdir(parents=True)
        self.config = {"expo": {"version": "3.0.0", "ios": {"bundleIdentifier": "com.nessjs.animu", "buildNumber": "6", "supportsTablet": False}}}
        self.info = {
            "CFBundleIdentifier": "com.nessjs.animu", "CFBundleShortVersionString": "3.0.0", "CFBundleVersion": "6",
            "DTSDKName": "iphoneos27.0", "DTPlatformName": "iphoneos", "CFBundleSupportedPlatforms": ["iPhoneOS"],
            "MinimumOSVersion": "16.4",
            "UIDeviceFamily": [1], "UIBackgroundModes": ["audio"], "ITSAppUsesNonExemptEncryption": False,
            "NSPhotoLibraryAddUsageDescription": "Save stats card",
        }
        self.manifest = {"NSPrivacyTracking": False, "NSPrivacyAccessedAPITypes": [{"NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]}]}

    def run_validation(self):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(self.info))
        (self.app / "PrivacyInfo.xcprivacy").write_bytes(plistlib.dumps(self.manifest))
        return validator.validate(self.archive, self.config)

    def test_valid_device_archive_does_not_claim_distribution_approval(self):
        result = self.run_validation()
        self.assertFalse(result["distributionSigningValidated"])
        self.assertFalse(result["storeUploadValidated"])
        self.assertEqual(len(result["privacyManifests"]), 1)

    def test_rejects_stale_version_simulator_or_old_sdk(self):
        for key, value in [("CFBundleVersion", "5"), ("DTSDKName", "iphoneos25.0"), ("MinimumOSVersion", "12.5"), ("DTPlatformName", "iphonesimulator"), ("UIDeviceFamily", [1, 2])]:
            with self.subTest(key=key):
                old = self.info[key]; self.info[key] = value
                with self.assertRaises(ValueError): self.run_validation()
                self.info[key] = old

    def test_rejects_unexpected_permissions_or_network_weakening(self):
        for key, value in [("NSMicrophoneUsageDescription", "unexpected"), ("NSAppTransportSecurity", {"NSAllowsArbitraryLoads": True})]:
            with self.subTest(key=key):
                self.info[key] = value
                with self.assertRaises(ValueError): self.run_validation()
                del self.info[key]

    def test_rejects_tracking_and_empty_required_reasons(self):
        self.manifest["NSPrivacyTracking"] = True
        with self.assertRaises(ValueError): self.run_validation()
        self.manifest["NSPrivacyTracking"] = False
        self.manifest["NSPrivacyAccessedAPITypes"][0]["NSPrivacyAccessedAPITypeReasons"] = []
        with self.assertRaises(ValueError): self.run_validation()


if __name__ == "__main__":
    unittest.main()
