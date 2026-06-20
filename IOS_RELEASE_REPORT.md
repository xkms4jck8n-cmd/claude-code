# iOS RELEASE REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Capacitor 7.6.6 · deployment target iOS 14.0 · builds against iOS 18 SDK_

## Build status (this environment — Linux, no Xcode/CocoaPods)

| Step | Status |
|------|:------:|
| `tsc --noEmit` (typed code) | ✅ exit 0 |
| `vite build` (web bundle) | ✅ clean, no warnings |
| `npx cap sync ios` | ✅ 6 plugins, Sync finished |
| Embedded fonts in iOS bundle | ✅ 12 data-URI fonts |
| Asset catalogs | ✅ AppIcon 1024 (opaque), Splash ×3 |

`pod install`, the Simulator run, the Release/Archive build, and App Store upload
**must be performed on a Mac with Xcode 15/16** — they cannot run here. All native
files, the Podfile, plugin registration, signing placeholders and the patch are
prepared for that one step.

## Warnings / deprecations resolved (no suppression)

| Warning | Fix | Status |
|---------|-----|:------:|
| `[CP] Embed Pods Frameworks` runs every build | Podfile: removed `disable_input_output_paths` → CocoaPods regenerates xcfilelists; phase is dependency-analyzed | ✅ |
| `UNNotificationPresentationOptions.alert` deprecated (iOS 14) | `.banner` + `.list`; persisted via `patch-package` + `postinstall` | ✅ |
| `@UIApplicationMain` deprecated (Swift 5.9) | `@main` | ✅ |
| Xcode 16 / iOS 18 + CocoaPods script sandboxing | `ENABLE_USER_SCRIPT_SANDBOXING = NO` (App target, both configs) | ✅ |

## Known upstream warnings (benign — documented, not suppressed)

| Warning | Why it remains |
|---------|----------------|
| `WKProcessPool` deprecated (iOS 15) — `CapacitorCordova` | Apple removed the concept with **no replacement that returns a `WKProcessPool`**; only fixable upstream in Capacitor or by suppression (disallowed). No runtime/App-Store impact. |
| `CAP_PLUGIN` auto property synthesis (`identifier`/`jsName`/`pluginMethods`) | Artifact of Capacitor's core macro, not the plugin files. Upstream-only. Plugins register and work correctly. |

## App Store readiness

| Item | State |
|------|-------|
| Bundle ID | `com.yahya.knowledgekingdom` (Debug + Release) |
| Signing | Automatic; `DEVELOPMENT_TEAM` placeholder + instructions (READY_FOR_XCODE.md) |
| Version | 7.0 (build 1) |
| Min iOS / devices | 14.0 / iPhone + iPad |
| Capabilities flag | `UIRequiredDeviceCapabilities = arm64` (not `armv7`) |
| Encryption compliance | `ITSAppUsesNonExemptEncryption = false` (no upload prompt) |
| Localization | `ar` primary + `en` |
| Icon | Opaque RGB 1024 (no alpha) — App-Store compliant |
| Notifications | Local only; runtime permission; no Info.plist key needed |

## Commands to finish on a Mac
```bash
npm install          # postinstall re-applies the LocalNotifications patch
npm run build
npx cap sync ios     # runs pod install (regenerates xcfilelists)
npx cap open ios     # Product ▸ Clean Build Folder, then build Debug + Release; Archive
```

## Residual risk
The only items not verifiable here are the macOS-only steps (pod install, Xcode
Debug/Release/Archive). Everything feeding them is generated and consistent; no
known blocker remains.
