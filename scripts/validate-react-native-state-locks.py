"""Reject a release that compiled React Native without the state lifetime fix."""
import json
import pathlib
import re
import subprocess
import sys
import zipfile


CLASS_NAME = "com.facebook.react.fabric.StateWrapperImpl"
CLASS_FILE = CLASS_NAME.replace(".", "/") + ".class"
METHODS = ("getStateDataMapBuffer", "getStateData", "getStateDataReference",
           "updateState", "destroyState", "toString")


def validate_jar(jar):
    declarations = subprocess.check_output(
        ["javap", "-p", "-classpath", str(jar), CLASS_NAME], text=True)
    for method in METHODS:
        pattern = rf"(?m)^\s*(?=[^\n;]*\bsynchronized\b)[^\n;]*\b{method}\("
        if not re.search(pattern, declarations):
            raise ValueError(f"React Native state lifetime lock missing on {method}")


def validate_build(build):
    jars = []
    for jar in pathlib.Path(build).glob("intermediates/**/release/**/classes.jar"):
        with zipfile.ZipFile(jar) as archive:
            if CLASS_FILE in archive.namelist():
                validate_jar(jar)
                jars.append(str(jar))
    if not jars:
        raise ValueError("No source-built Release StateWrapperImpl; a source patch alone is insufficient")
    return {"verifiedJars": jars, "lifetimeLockedMethods": list(METHODS)}


if __name__ == "__main__":
    print(json.dumps(validate_build(sys.argv[1]), indent=2))
