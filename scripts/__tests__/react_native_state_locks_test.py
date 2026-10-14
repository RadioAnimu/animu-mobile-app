"""Check the compiled-artifact gate against patched and unpatched bytecode."""
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest
import zipfile


spec = importlib.util.spec_from_file_location(
    "state_locks", pathlib.Path(__file__).parents[1] / "validate-react-native-state-locks.py")
locks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(locks)


class CompiledStateLockTests(unittest.TestCase):
    @staticmethod
    def compile_fixture(directory, unlocked=None):
        root = pathlib.Path(directory)
        source = root / "StateWrapperImpl.java"
        methods = [f"public {'synchronized ' if name != unlocked else ''}Object {name}() {{ return null; }}"
                   for name in locks.METHODS if name != "toString"]
        methods.append("public synchronized String toString() { return \"test\"; }")
        source.write_text("package com.facebook.react.fabric; public class StateWrapperImpl {"
                          + "\n".join(methods) + "}")
        subprocess.run(["javac", "-d", str(root), str(source)], check=True, capture_output=True)
        jar = root / "intermediates/runtime_library_classes_jar/release/bundleLibRuntimeToJarRelease/classes.jar"
        jar.parent.mkdir(parents=True)
        with zipfile.ZipFile(jar, "w") as archive:
            archive.write(root / locks.CLASS_FILE, locks.CLASS_FILE)

    def test_compiled_monitor_contract_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            self.compile_fixture(directory)
            self.assertEqual(len(locks.validate_build(directory)["verifiedJars"]), 1)

    def test_unlocked_native_read_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            self.compile_fixture(directory, "getStateDataReference")
            with self.assertRaisesRegex(ValueError, "getStateDataReference"):
                locks.validate_build(directory)

    def test_precompiled_dependency_without_source_output_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "source-built"):
                locks.validate_build(directory)


if __name__ == "__main__":
    unittest.main()
