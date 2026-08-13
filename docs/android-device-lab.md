# Android real-device lab

This lab turns a dedicated Android phone into a repeatable performance/stability perimeter for GYSApp. The first target device is a Redmi Note 10 Pro (Snapdragon 732G), intentionally representing an older but still usable low-to-mid-range baseline.

## Trust boundary

The ChatGPT/GitHub connector cannot open arbitrary sockets into a private Tailscale network. Real-device access therefore runs through a **GitHub self-hosted runner** that is already inside the same trusted tailnet as the phone.

Use a dedicated runner host. The workflow is `workflow_dispatch` only and never runs on pull-request events.

Recommended runner labels:

- `self-hosted`
- `android-device-lab`

The current workflow expects a Linux runner with `python3` and Android platform-tools (`adb`) on `PATH`.

## Preferred transport

### Option A — USB (recommended for unattended soak)

Keep the Redmi connected to the runner by USB, enable USB debugging, and authorize the runner host once. Leave the repository variable `ANDROID_LAB_ADB_TARGET` unset.

The harness refuses to guess when more than one ready USB device is attached.

### Option B — ADB over Tailscale

For a fixed TCP endpoint, establish ADB TCP mode from a trusted local/USB session first:

```bash
adb tcpip 5555
```

Then verify from the self-hosted runner that the phone's Tailscale address is reachable:

```bash
adb connect <tailscale-ip-or-magicdns>:5555
adb devices -l
```

Set repository/environment variable:

```text
ANDROID_LAB_ADB_TARGET=<tailscale-ip-or-magicdns>:5555
```

Do **not** expose ADB port 5555 to the public internet. Restrict the tailnet ACL so only the dedicated lab runner can reach the phone's ADB endpoint. Some OEM/OS builds may require ADB TCP to be enabled again after a reboot; USB is preferred when truly unattended operation is required.

Android 11+ Wireless Debugging with pairing is also valid, but its pairing/discovery/port lifecycle is less convenient for a permanent remote lab. Use it only when the runner-device network arrangement is known to keep the paired transport stable.

## GitHub environment

Create/protect the `android-device-lab` environment. Keep the runner dedicated to trusted GYSApp workflows and do not expose it to arbitrary fork PR execution.

No ADB private key, pairing code, Tailscale auth key, or device credential belongs in repository source or chat. The only value the workflow needs for fixed TCP mode is the already-authorized ADB target address.

## Workflow

Run **Actions → android-device-lab → Run workflow** and choose:

- soak duration: 5 / 15 / 30 / 60 / 120 minutes;
- cold launch iterations: 3 / 5 / 10;
- whether to clear `com.gysid.gysapp` app data first.

`reset_app_data` defaults to **false**. Enable it only on a dedicated lab phone when a clean-state run is intentional.

The workflow builds the ARM64 debug APK on a GitHub-hosted runner, downloads the exact APK into the self-hosted device runner, installs/reinstalls it, verifies `com.gysid.gysapp`, then captures:

- device/manufacturer/model/Android/SDK/ABI/security patch;
- ADB inventory and install result;
- repeated cold-launch `am start -W` output;
- pre/post `dumpsys meminfo`;
- periodic memory/CPU/thermal/battery samples;
- `dumpsys gfxinfo ... framestats`;
- activity/package dumps;
- full post-run logcat;
- package-scoped FATAL EXCEPTION / ANR markers;
- a compact `SUMMARY.txt`.

Evidence artifacts are retained for 14 days and are pinned to the workflow SHA/run id.

## Baseline strategy

Do not hard-code aggressive performance thresholds before observing the first device baseline. Run at least three comparable 30-minute sessions on the Redmi Note 10 Pro first, then use the distribution rather than a single best run to set budgets.

Initial release expectations:

- zero package-scoped crash/ANR markers;
- no progressive memory growth that continues every sample without settling;
- cold launch remains usable on the Snapdragon 732G baseline;
- foreground soak does not reach sustained severe thermal throttling under ordinary reading/worship journeys;
- background/foreground, MIDI/PDF, orientation, notification, and offline journeys are subsequently layered on as deterministic device flows.

## What this harness does not prove yet

The baseline harness does not automatically click every WebView feature. TalkBack correctness, scheduled-notification delivery, long MIDI/PDF user journeys, and orientation/accessibility behavior remain explicit real-device journeys until deterministic UI flows are added.

Once the runner is connected and baseline evidence is available, extend the lab in small steps rather than adding a large flaky automation suite at once. The next candidates are deterministic reader, MIDI/PDF, background/foreground, offline, and notification-delivery flows.
