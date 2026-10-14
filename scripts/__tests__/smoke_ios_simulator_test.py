"""A successful launch must not hide a subsequent app crash."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "smoke_ios_simulator", pathlib.Path(__file__).parents[1] / "smoke-ios-simulator.py")
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SimulatorSmokeTests(unittest.TestCase):
    @staticmethod
    def simctl(*args):
        if args[0] == "list":
            return json.dumps({"devices": {"com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
                {"name": "iPhone 17", "udid": "test-device", "state": "Booted",
                 "isAvailable": True}]}})
        if args[0] == "launch":
            return "com.nessjs.animu: 12345\n"
        if args[0] == "spawn":
            self_error = "Do not depend on executables installed inside iOS"
            raise AssertionError(self_error)
        return ""

    def test_release_process_is_checked_on_host(self):
        with tempfile.TemporaryDirectory() as output, \
                patch.object(smoke, "run", side_effect=self.simctl), \
                patch.object(smoke.time, "sleep"), \
                patch.object(smoke.os, "kill") as kill:
            smoke.main("test.app", output)
            kill.assert_called_once_with(12345, 0)
            result = json.loads((pathlib.Path(output) / "ios-simulator-smoke.json").read_text())
            self.assertTrue(result["releaseProcessRemainedAlive"])
            self.assertFalse(result["authenticatedFlowsValidated"])

    def test_dead_release_process_fails_without_success_report(self):
        with tempfile.TemporaryDirectory() as output, \
                patch.object(smoke, "run", side_effect=self.simctl), \
                patch.object(smoke.time, "sleep"), \
                patch.object(smoke.os, "kill", side_effect=ProcessLookupError):
            with self.assertRaises(ProcessLookupError):
                smoke.main("test.app", output)
            self.assertFalse((pathlib.Path(output) / "ios-simulator-smoke.json").exists())


if __name__ == "__main__":
    unittest.main()
