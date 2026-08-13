# ADR-0007 — New public application identity

Date: 13 August 2026
Status: Accepted

## Context

The legacy Flutter application used Android application id `id.sch.kanaan.egys`. Earlier GYSApp migration work preserved that identity because an in-place upgrade path was still under consideration.

The product decision has changed: the web/Tauri GYSApp will be released as a **new application**, not as an update of the legacy package.

## Decision

Use the new cross-platform Tauri identifier:

```text
com.gysid.gysapp
```

Tauri v2 uses the configured identifier as the Android package/application id and iOS bundle identifier. Generated Android namespace/applicationId and native entry-point package must remain aligned with it.

The initial migration intentionally keeps the existing project version (`2.2.0`) and Android versionCode (`134`) unchanged so the identity change can be validated independently. Version numbering may be reset/rebased before the first public store submission because `com.gysid.gysapp` has not inherited the legacy Play identity.

## Signing

Android release signing remains strict:

- signing material is supplied only through GitHub Secrets;
- `ANDROID_CERT_SHA256` remains mandatory;
- the workflow verifies the input keystore fingerprint and the final APK/AAB fingerprints;
- the expected certificate is now the **new GYSApp production/upload signing identity**, not the legacy `id.sch.kanaan.egys` certificate.

Do not commit keystores, passwords, Tailscale credentials, or signing material to the repository.

## Data and compatibility consequences

Changing the Android application id intentionally creates a separate application sandbox and store identity.

Therefore:

- Android will not install `com.gysid.gysapp` as an update over `id.sch.kanaan.egys`;
- both apps may coexist on the same device;
- private app data from the legacy package is not automatically inherited by the new package;
- if users need data continuity, use an explicit migration path such as GYSApp encrypted backup/export-import rather than relying on package upgrade semantics;
- no legacy production keystore is required merely to publish the new application.

Feature/data-format compatibility inside GYSApp remains a product requirement: Bible packs, bookmarks/history, settings backup, notes, playlists, chord/MIDI/PDF behavior, external e-GYS boundary, and other shared logic are not intentionally changed by this identity decision.

## Superseded assumptions

Any earlier roadmap/parity/runbook statement requiring:

- preservation of `id.sch.kanaan.egys`;
- production install-over-legacy upgrade smoke; or
- the legacy Android signing certificate

is superseded by this ADR.

The new release gates are:

1. build and verify `com.gysid.gysapp` on Android;
2. verify the same Tauri identifier is generated for iOS;
3. establish and pin a new Android release signing identity before first store publication;
4. run real-device stability/accessibility/performance validation on the new package;
5. validate explicit backup/import compatibility when migration from legacy user data is required.
