"""Anonymous Release launch smoke check; does not claim authenticated E2E."""
import json
import pathlib
import subprocess
import sys
import time


def run(*args):
    return subprocess.check_output(["xcrun", "simctl", *args], text=True)


def main(app, output):
    output = pathlib.Path(output)
    devices = json.loads(run("list", "devices", "available", "--json"))["devices"]
    candidates = [device for runtime, entries in devices.items()
                  if "iOS-" in runtime for device in entries
                  if device.get("isAvailable") and device["name"].startswith("iPhone")]
    if not candidates:
        raise RuntimeError("No available iPhone simulator on the macOS runner")
    device = candidates[0]
    udid = device["udid"]
    if device["state"] != "Booted":
        run("boot", udid)
    run("bootstatus", udid, "-b")
    run("install", udid, app)
    launched = run("launch", udid, "com.nessjs.animu")
    pid = int(launched.rsplit(":", 1)[-1].strip())
    time.sleep(10)
    run("openurl", udid, "animuapp://assistant/play")
    time.sleep(20)
    # Launching succeeded is insufficient: catch a process that dies afterwards.
    run("spawn", udid, "kill", "-0", str(pid))
    run("io", udid, "screenshot", str(output / "ios-launch.png"))
    result = {"device": device["name"], "releaseProcessRemainedAlive": True,
              "assistantPlayLinkDelivered": True, "authenticatedFlowsValidated": False,
              "audioOutputValidated": False}
    (output / "ios-simulator-smoke.json").write_text(json.dumps(result, indent=2))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
