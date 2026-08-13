#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PACKAGE = os.environ.get("PACKAGE_NAME", "com.gysid.gysapp")
ADB_TARGET = os.environ.get("ADB_TARGET", "").strip()
APK_PATH = Path(os.environ.get("APK_PATH", "device-lab-apk/GYSApp-android-debug-arm64.apk"))
OUTPUT = Path(os.environ.get("DEVICE_LAB_OUTPUT", "dist/android-device-lab"))
SOAK_MINUTES = max(0, int(os.environ.get("SOAK_MINUTES", "30")))
COLD_LAUNCH_ITERATIONS = max(1, int(os.environ.get("COLD_LAUNCH_ITERATIONS", "5")))
RESET_APP_DATA = os.environ.get("RESET_APP_DATA", "false").lower() == "true"


def run(args: list[str], *, check: bool = True, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(args, text=True, capture_output=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise RuntimeError(
            f"command failed ({proc.returncode}): {' '.join(args)}\n{proc.stdout}\n{proc.stderr}"
        )
    return proc


def write(name: str, text: str) -> None:
    (OUTPUT / name).write_text(text, encoding="utf-8", errors="replace")


def append(name: str, text: str) -> None:
    with (OUTPUT / name).open("a", encoding="utf-8", errors="replace") as handle:
        handle.write(text)


def adb(serial: str, *args: str, check: bool = True, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return run(["adb", "-s", serial, *args], check=check, timeout=timeout)


def shell(serial: str, command: str, *, check: bool = True, timeout: int = 120) -> str:
    proc = adb(serial, "shell", command, check=check, timeout=timeout)
    return (proc.stdout or "") + (proc.stderr or "")


def connected_serial() -> str:
    if ADB_TARGET:
        connect = run(["adb", "connect", ADB_TARGET], check=False, timeout=30)
        print((connect.stdout or connect.stderr).strip())
        serial = ADB_TARGET
    else:
        devices = run(["adb", "devices"]).stdout.splitlines()[1:]
        ready = [line.split()[0] for line in devices if line.strip().endswith("\tdevice")]
        if len(ready) != 1:
            raise RuntimeError(
                f"Expected exactly one USB/ready ADB device when ANDROID_LAB_ADB_TARGET is unset; found {ready}"
            )
        serial = ready[0]

    adb(serial, "wait-for-device", timeout=60)
    state = adb(serial, "get-state").stdout.strip()
    if state != "device":
        raise RuntimeError(f"ADB target {serial} is not ready: {state}")
    return serial


def device_info(serial: str) -> str:
    props = {
        "manufacturer": "ro.product.manufacturer",
        "model": "ro.product.model",
        "device": "ro.product.device",
        "android": "ro.build.version.release",
        "sdk": "ro.build.version.sdk",
        "abi": "ro.product.cpu.abi",
        "build": "ro.build.display.id",
        "security_patch": "ro.build.version.security_patch",
    }
    lines = [f"captured_at={datetime.now(timezone.utc).isoformat()}", f"serial={serial}"]
    for label, prop in props.items():
        value = shell(serial, f"getprop {prop}").strip()
        lines.append(f"{label}={value}")
    return "\n".join(lines) + "\n"


def capture_sample(serial: str, index: int) -> None:
    stamp = datetime.now(timezone.utc).isoformat()
    append("samples.txt", f"\n===== sample {index} @ {stamp} =====\n")
    append("samples.txt", "\n--- meminfo ---\n" + shell(serial, f"dumpsys meminfo {PACKAGE}", check=False))
    append("samples.txt", "\n--- cpuinfo ---\n" + shell(serial, f"dumpsys cpuinfo | grep -F '{PACKAGE}'", check=False))
    append("samples.txt", "\n--- thermal ---\n" + shell(serial, "dumpsys thermalservice", check=False))
    append("samples.txt", "\n--- battery ---\n" + shell(serial, "dumpsys battery", check=False))


def crash_markers(logcat: str) -> str:
    lines = logcat.splitlines()
    findings: list[str] = []
    for index, line in enumerate(lines):
        if f"ANR in {PACKAGE}" in line:
            findings.append(line)
        if "FATAL EXCEPTION" in line:
            window = lines[index : index + 10]
            if any(PACKAGE in candidate for candidate in window):
                findings.extend(window)
    return "\n".join(findings).strip()


def main() -> int:
    if shutil.which("adb") is None:
        raise RuntimeError("adb is not available on PATH of the self-hosted runner")
    if not APK_PATH.is_file():
        raise RuntimeError(f"APK not found: {APK_PATH}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    serial = connected_serial()
    write("device-info.txt", device_info(serial))
    write("adb-devices.txt", run(["adb", "devices", "-l"]).stdout)

    install = adb(serial, "install", "-r", "-t", str(APK_PATH), timeout=300)
    write("install.txt", (install.stdout or "") + (install.stderr or ""))

    package_path = shell(serial, f"pm path {PACKAGE}").strip()
    if not package_path.startswith("package:"):
        raise RuntimeError(f"Installed package {PACKAGE} was not found: {package_path}")
    write("package-path.txt", package_path + "\n")

    if RESET_APP_DATA:
        write("pm-clear.txt", shell(serial, f"pm clear {PACKAGE}"))

    adb(serial, "logcat", "-c", check=False)
    write("pre-meminfo.txt", shell(serial, f"dumpsys meminfo {PACKAGE}", check=False))

    for index in range(1, COLD_LAUNCH_ITERATIONS + 1):
        shell(serial, f"am force-stop {PACKAGE}", check=False)
        time.sleep(1)
        launch = shell(serial, f"am start -W -n {PACKAGE}/.MainActivity", check=False)
        append("cold-launch.txt", f"\n===== launch {index} =====\n{launch}")
        time.sleep(2)

    start = time.monotonic()
    deadline = start + SOAK_MINUTES * 60
    sample_index = 0
    while True:
        sample_index += 1
        capture_sample(serial, sample_index)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        time.sleep(min(60, remaining))

    write("post-meminfo.txt", shell(serial, f"dumpsys meminfo {PACKAGE}", check=False))
    write("gfxinfo.txt", shell(serial, f"dumpsys gfxinfo {PACKAGE} framestats", check=False))
    write("activity-top.txt", shell(serial, "dumpsys activity top", check=False))
    write("package-dump.txt", shell(serial, f"dumpsys package {PACKAGE}", check=False))

    logcat = adb(serial, "logcat", "-d", "-v", "threadtime", check=False, timeout=180).stdout
    write("logcat.txt", logcat)
    markers = crash_markers(logcat)
    write("crash-anr-markers.txt", markers + ("\n" if markers else "no package-scoped FATAL EXCEPTION/ANR markers detected\n"))

    summary = [
        f"package={PACKAGE}",
        f"serial={serial}",
        f"soak_minutes={SOAK_MINUTES}",
        f"cold_launch_iterations={COLD_LAUNCH_ITERATIONS}",
        f"reset_app_data={RESET_APP_DATA}",
        f"crash_or_anr_detected={bool(markers)}",
    ]
    write("SUMMARY.txt", "\n".join(summary) + "\n")

    if markers:
        print("Package-scoped crash/ANR markers were detected; see crash-anr-markers.txt", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        write("HARNESS_ERROR.txt", f"{type(exc).__name__}: {exc}\n")
        print(f"device-lab harness failed: {exc}", file=sys.stderr)
        raise
