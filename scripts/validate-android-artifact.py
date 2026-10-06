"""Validate release manifest and 64-bit ELF page alignment without external packages."""
import json
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile

ANDROID = "{http://schemas.android.com/apk/res/android}"


def validate_manifest(manifest, config):
    expected = config["expo"]
    if manifest.get("package") != expected["android"]["package"]:
        raise ValueError("Release package does not match app configuration")
    for name, value in [("versionCode", expected["android"]["versionCode"]), ("versionName", expected["version"])]:
        if manifest.get(ANDROID + name) != str(value):
            raise ValueError(f"Release {name} does not match app configuration")
    sdk = manifest.find("uses-sdk")
    target = next(options["android"]["targetSdkVersion"] for name, options in
                  (plugin for plugin in expected["plugins"] if isinstance(plugin, list))
                  if name == "expo-build-properties")
    if sdk is None or sdk.get(ANDROID + "targetSdkVersion") != str(target):
        raise ValueError("Release target SDK does not match app configuration")
    app = manifest.find("application")
    if app is None:
        raise ValueError("Application manifest missing")
    for name in ["debuggable", "testOnly", "usesCleartextTraffic"]:
        if app.get(ANDROID + name, "false") != "false":
            raise ValueError(f"Unsafe release application attribute: {name}")
    blocked = set(expected["android"]["blockedPermissions"])
    permissions = {entry.get(ANDROID + "name") for entry in manifest.findall("uses-permission")}
    if permissions & blocked:
        raise ValueError("Blocked permission found in merged release manifest")
    if not any("mediaPlayback" in service.get(ANDROID + "foregroundServiceType", "").split("|")
               for service in app.findall("service")):
        raise ValueError("Background playback service declaration missing")


def validate_elf(data):
    if data[:4] != b"\x7fELF" or data[4] != 2:
        raise ValueError("Expected a 64-bit ELF library")
    if data[5] not in [1, 2]:
        raise ValueError("Invalid ELF byte order")
    endian = "<" if data[5] == 1 else ">"
    offset = struct.unpack_from(endian + "Q", data, 32)[0]
    size, count = struct.unpack_from(endian + "HH", data, 54)
    if size < 56 or offset + size * count > len(data):
        raise ValueError("Invalid ELF program headers")
    loads = 0
    for index in range(count):
        kind, _, file_offset, address, _, _, _, alignment = struct.unpack_from(
            endian + "IIQQQQQQ", data, offset + size * index)
        if kind != 1:  # PT_LOAD
            continue
        loads += 1
        if alignment < 16384 or alignment & (alignment - 1) or (address - file_offset) % alignment:
            raise ValueError("ELF load segment is incompatible with 16 KB pages")
    if not loads:
        raise ValueError("ELF library has no load segments")


def main():
    artifact, manifest_path, config_path = sys.argv[1:]
    with open(config_path, encoding="utf8") as stream:
        config = json.load(stream)
    validate_manifest(ET.parse(manifest_path).getroot(), config)
    checked = 0
    with zipfile.ZipFile(artifact) as archive:
        for entry in archive.namelist():
            if entry.endswith(".so") and any(f"/lib/{abi}/" in "/" + entry for abi in ["arm64-v8a", "x86_64"]):
                validate_elf(archive.read(entry))
                checked += 1
    if not checked:
        raise ValueError("No 64-bit native libraries found in release artifact")
    print(f"Release manifest and {checked} native libraries passed 16 KB ELF validation")


if __name__ == "__main__":
    main()
