import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location("artifact", Path(__file__).parents[1] / "validate-android-artifact.py")
artifact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifact)


class AlignmentTests(unittest.TestCase):
    def elf(self, alignment=16384, offset=0, address=0):
        data = bytearray(120)
        data[:6] = b"\x7fELF\x02\x01"
        struct.pack_into("<Q", data, 32, 64)
        struct.pack_into("<HH", data, 54, 56, 1)
        struct.pack_into("<IIQQQQQQ", data, 64, 1, 5, offset, address, 0, 0, 0, alignment)
        return data

    def test_supports_16k_and_larger_segments(self):
        for alignment in [16384, 65536]:
            artifact.validate_elf(self.elf(alignment))

    def test_rejects_4k_and_incongruent_segments(self):
        for data in [self.elf(4096), self.elf(offset=1), self.elf(24576)]:
            with self.assertRaises(ValueError):
                artifact.validate_elf(data)

    def test_rejects_missing_and_truncated_program_headers(self):
        data = self.elf()
        struct.pack_into("<H", data, 56, 0)
        for invalid in [data, self.elf()[:80]]:
            with self.assertRaises(ValueError):
                artifact.validate_elf(invalid)

class ManifestTests(unittest.TestCase):
    def setUp(self):
        import xml.etree.ElementTree as ET
        self.config = {"expo": {"version": "3.0.0", "android": {"package": "example.animu", "versionCode": 16, "blockedPermissions": ["android.permission.RECORD_AUDIO"]}, "plugins": [["expo-build-properties", {"android": {"targetSdkVersion": 36}}]]}}
        self.manifest = ET.fromstring('<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="example.animu" android:versionCode="16" android:versionName="3.0.0"><uses-sdk android:targetSdkVersion="36"/><application><service android:foregroundServiceType="mediaPlayback"/></application></manifest>')

    def test_accepts_release_defaults(self):
        artifact.validate_manifest(self.manifest, self.config)

    def test_rejects_debug_test_and_cleartext_configuration(self):
        app = self.manifest.find("application")
        for attribute in ["debuggable", "testOnly", "usesCleartextTraffic"]:
            app.set(artifact.ANDROID + attribute, "true")
            with self.assertRaises(ValueError):
                artifact.validate_manifest(self.manifest, self.config)
            del app.attrib[artifact.ANDROID + attribute]

    def test_rejects_wrong_target_and_missing_playback_service(self):
        self.manifest.find("uses-sdk").set(artifact.ANDROID + "targetSdkVersion", "35")
        with self.assertRaises(ValueError):
            artifact.validate_manifest(self.manifest, self.config)
        self.manifest.find("uses-sdk").set(artifact.ANDROID + "targetSdkVersion", "36")
        self.manifest.find("application").remove(self.manifest.find("application/service"))
        with self.assertRaises(ValueError):
            artifact.validate_manifest(self.manifest, self.config)

    def test_rejects_permission_leaked_from_dependency(self):
        import xml.etree.ElementTree as ET
        ET.SubElement(self.manifest, "uses-permission", {artifact.ANDROID + "name": "android.permission.RECORD_AUDIO"})
        with self.assertRaises(ValueError):
            artifact.validate_manifest(self.manifest, self.config)


if __name__ == "__main__":
    unittest.main()
