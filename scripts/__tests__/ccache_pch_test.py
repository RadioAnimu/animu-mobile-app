"""Exercise actual NDK Clang/PCH cache hits and source/header invalidation."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


CLANGS = sorted(Path(os.environ.get("ANDROID_SDK_ROOT", "/nonexistent")).glob(
    "ndk/*/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++"))
CCACHE = shutil.which("ccache")


@unittest.skipUnless(CLANGS and CCACHE, "requires Android NDK Clang and ccache")
class PrecompiledHeaderCacheTest(unittest.TestCase):
    def test_hits_and_input_invalidation(self):
        with tempfile.TemporaryDirectory(prefix="animu-pch-") as directory:
            root = Path(directory)
            env = {**os.environ, "CCACHE_DIR": str(root / "cache"),
                   "CCACHE_CONFIGPATH": str(Path(__file__).resolve().parents[1] / "ccache.conf")}
            compiler = [CCACHE, str(CLANGS[-1]), "-Xclang", "-fno-pch-timestamp"]

            def run(*args):
                return subprocess.check_output(args, cwd=root, env=env, stderr=subprocess.STDOUT)

            def pch():
                run(*compiler, "-x", "c++-header", "header.hpp", "-o", "header.pch")

            def object_bytes():
                run(*compiler, "-include-pch", "header.pch", "-c", "main.cpp", "-o", "main.o")
                return hashlib.sha256((root / "main.o").read_bytes()).hexdigest()

            (root / "header.hpp").write_text("#define VALUE 7\n")
            (root / "main.cpp").write_text("int value() { return VALUE; }\n")
            pch()
            first = object_bytes()
            (root / "main.o").unlink()
            self.assertEqual(first, object_bytes())
            stats = dict(line.split() for line in run(CCACHE, "--print-stats").decode().splitlines())
            self.assertGreater(int(stats["direct_cache_hit"]) + int(stats["preprocessed_cache_hit"]), 0)
            self.assertEqual(int(stats["could_not_use_precompiled_header"]), 0)

            (root / "header.hpp").write_text("#define VALUE 11\n")
            pch()
            changed_header = object_bytes()
            self.assertNotEqual(first, changed_header)
            (root / "main.cpp").write_text("int value() { return VALUE + 1; }\n")
            self.assertNotEqual(changed_header, object_bytes())
