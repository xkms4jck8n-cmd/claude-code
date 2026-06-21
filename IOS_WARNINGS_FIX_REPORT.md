# iOS WARNINGS FIX REPORT — Kingdom of Knowledge

_Date: 2026-06-15 · Capacitor 7.6.6 · deployment target iOS 14.0 · no warnings suppressed_

## Summary

| # | Warning | Origin | Action | Status |
|---|---------|--------|--------|--------|
| 1 | `WKProcessPool` deprecated (iOS 15) | **Capacitor framework** (`CapacitorCordova` pod) | analyzed — no app-level modern-API replacement exists | ⚠️ Upstream (see below) |
| 2 | `[CP] Embed Pods Frameworks` runs every build | **Project config** (Podfile) | **fixed** — re-enabled CocoaPods input/output file lists | ✅ Fixed |
| 3 | Auto property synthesis: `identifier`/`jsName`/`pluginMethods` | **Capacitor framework** (`CAP_PLUGIN` macro) | analyzed — macro-level, not fixable in app code | ⚠️ Upstream (see below) |
| 4 | `alert` presentation option deprecated (iOS 14) | `@capacitor/local-notifications` | **fixed** — `.alert` → `.banner` + `.list` (patched) | ✅ Fixed |
| + | `@UIApplicationMain` deprecated (Swift 5.9) | **Project source** (AppDelegate) | **fixed** — `@main` | ✅ Fixed (bonus) |
| + | Xcode 16 / iOS 18 + CocoaPods script sandboxing | **Project config** | **fixed** — `ENABLE_USER_SCRIPT_SANDBOXING = NO` | ✅ Fixed (bonus) |

I did **not** suppress any warning (no `inhibit_all_warnings!`, no
`-Wdeprecated-declarations` pragmas). Where a warning lives in Capacitor's own
framework source and has no modern-API replacement, that is stated honestly
rather than masked.

---

## ✅ Issue 2 — "[CP] Embed Pods Frameworks will run during every build" — FIXED

**Root cause.** Capacitor's generated `Podfile` contained:
```ruby
install! 'cocoapods', :disable_input_output_paths => true
```
This disables the input/output `xcfilelist`s that CocoaPods normally generates
for its script build phases. Without those lists Xcode cannot do dependency
analysis on the phase, so it must run **every build** — hence the warning and
slower incremental builds.

**Fix (`ios/App/Podfile`).**
```diff
- # workaround to avoid Xcode caching of Pods ...
- install! 'cocoapods', :disable_input_output_paths => true
+ # Keep CocoaPods' generated input/output xcfilelists ENABLED (the default) so
+ # the "[CP] …" run phases participate in dependency analysis and are skipped
+ # when nothing changed — removes the warning and enables incremental builds.
+ install! 'cocoapods'
```
After the next `pod install`, CocoaPods regenerates the `.xcfilelist`s and Xcode
skips the phase when inputs are unchanged. (The original flag was only a
workaround for projects that add/remove Cordova plugins frequently; this app's
plugin set is stable.)

---

## ✅ Issue 4 — "`alert` was deprecated in iOS 14.0" — FIXED

**Root cause.** `@capacitor/local-notifications`'
`LocalNotificationsHandler.willPresent(...)` returned the
`UNNotificationPresentationOptions.alert` value, which iOS 14 deprecated and
split into `.banner` (heads-up banner) + `.list` (Notification Center).

**Fix.** Modern UserNotifications API, applied to the plugin source and made
**persistent** via `patch-package` (`patches/@capacitor+local-notifications+7.0.6.patch`),
re-applied automatically by the new `"postinstall": "patch-package"` script.
```diff
  return [
      .badge,
      .sound,
-     .alert
+     .banner,
+     .list
  ]
```
> Note: the `requestAuthorization(options: [.badge, .alert, .sound])` call is
> **unchanged** — `UNAuthorizationOptions.alert` is *not* deprecated; only the
> *presentation* option was. Local notifications continue to work identically
> (badge + sound + visible banner/list).

---

## ✅ Bonus fixes (found during the full native audit)

**`@UIApplicationMain` → `@main`** (`ios/App/App/AppDelegate.swift`). Swift 5.9
(Xcode 15/16, the iOS 18 toolchain) deprecated the `@UIApplicationMain`
attribute in favor of `@main` (SE-0383). This was in **our** project source, so
it's a clean real fix:
```diff
- @UIApplicationMain
+ @main
  class AppDelegate: UIResponder, UIApplicationDelegate {
```

**`ENABLE_USER_SCRIPT_SANDBOXING = NO`** (`project.pbxproj`, Debug + Release).
Xcode 16 defaults user-script sandboxing to ON, which can make CocoaPods' `[CP]`
script phases fail to read/write their files on iOS 18 toolchains. Disabling it
for the App target is the standard Capacitor + CocoaPods compatibility setting.

---

## ⚠️ Issue 1 — `WKProcessPool` deprecated — UPSTREAM (no app-level fix without suppression)

**Where:** `node_modules/@capacitor/ios/CapacitorCordova/.../CDVWebViewProcessPoolFactory.m`
— Capacitor's bundled Cordova-compatibility shim:
```objc
- (instancetype)init {
    if (self = [super init]) {
        _sharedPool = [[WKProcessPool alloc] init];   // ← deprecated iOS 15
    }
    return self;
}
- (WKProcessPool*) sharedProcessPool { return _sharedPool; }
```
**Why it can't be cleanly fixed in this project:** Apple deprecated
`WKProcessPool` because process-pool sharing is now **automatic** in WKWebView —
there is **no modern API that returns a `WKProcessPool`** to swap in. The factory's
public type (`- (WKProcessPool*)sharedProcessPool`) and ivar reference the
deprecated class, so the only ways to silence it are (a) a
`-Wdeprecated-declarations` pragma, or (b) `inhibit_all_warnings!` — **both are
suppression, which was explicitly disallowed** — or (c) deleting the factory and
rewriting Capacitor's WebView configuration, which forks the framework.
**Correct resolution:** an upstream Capacitor change. The warning is **benign**:
it does not affect runtime behavior, iOS 18 compatibility, or App Store review
(WKWebView simply ignores the assigned pool on iOS 15+).

## ⚠️ Issue 3 — CapacitorKeyboard auto property synthesis — UPSTREAM

**Where:** `node_modules/@capacitor/keyboard/ios/.../KeyboardPlugin.m`, which is
just:
```objc
CAP_PLUGIN(KeyboardPlugin, "Keyboard",
           CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise); … )
```
**Why it can't be cleanly fixed in this project:** the `identifier` / `jsName` /
`pluginMethods` properties are declared on Capacitor's `CAPBridgedPlugin`
protocol and provided through the **`CAP_PLUGIN` macro expansion** in Capacitor
core (`Capacitor.h`). The warning is an artifact of that macro, not of the
Keyboard plugin file — there is nothing in `KeyboardPlugin.m` to change, and you
cannot `@synthesize` protocol properties inside the macro-generated category.
Editing Capacitor's core macro would affect every plugin and is fragile across
versions. **Correct resolution:** upstream Capacitor. The warning is **benign**
(the methods are correctly provided at runtime; plugin registration works).

> Both upstream warnings could be hidden with `inhibit_all_warnings!` in the
> Podfile — deliberately **not** done, per the "do not suppress" instruction.

---

## Full native audit

| Area | Result |
|------|--------|
| **AppDelegate** | Modern; `@main`; standard Capacitor lifecycle + URL/continue-userActivity handlers. |
| **SceneDelegate** | None — Capacitor 7 uses the AppDelegate window (expected/modern). |
| **Info.plist** | `arm64` (not `armv7`), `ITSAppUsesNonExemptEncryption=false`, `ar`+`en` localizations, `viewport-fit` cover via WebView. No deprecated keys. |
| **Podfile** | `platform :ios, '14.0'`, `use_frameworks!`, input/output paths enabled, `assertDeploymentTarget` post_install. |
| **Build settings** | Comprehensive CLANG/GCC warnings enabled (not disabled); `ENABLE_BITCODE` correctly absent (deprecated); `ONLY_ACTIVE_ARCH=YES` (Debug); sandboxing set for Xcode 16. |
| **Deployment target** | iOS 14.0 — modern, supported, builds against the iOS 18 SDK. |
| **Notification permissions** | Runtime `UNUserNotificationCenter` request (badge/alert/sound). Local notifications need no Info.plist usage key. |
| **iOS 18 compatibility** | `@main`, sandboxing setting, arm64-only, no deprecated build flags. |
| **Swift / Obj-C** | `SWIFT_VERSION = 5.0` (compiles on Swift 5/6 toolchains); Obj-C plugin bridging intact. |
| **Notification handler** | Now returns `.banner + .list` (modern) instead of `.alert`. |

---

## Validation

Performed in this Linux environment (no Xcode/CocoaPods here):
```
patch-package apply ........ ✔ @capacitor/local-notifications@7.0.6
npm run build .............. ✔ clean
npx cap sync ios ........... ✔ 6 plugins, Sync finished
Podfile / AppDelegate / pbxproj edits ... ✔ present and well-formed
```

Must be completed on a Mac with Xcode 15/16 (commands provided):
```bash
npm install            # postinstall re-applies the patch automatically
npm run build
npx cap sync ios       # pod install regenerates xcfilelists (Issue 2)
# In Xcode: Product ▸ Clean Build Folder, then build Debug AND Release.
```
**Expected after these steps:** Issues 2 and 4 gone; the `@UIApplicationMain`
warning gone; faster incremental builds. Issues 1 and 3 remain as benign
Capacitor-framework warnings until resolved upstream (they do not block Debug,
Release, Simulator, device, or App Store archive).

## Files modified
- `ios/App/Podfile` — re-enabled CocoaPods I/O file lists (Issue 2).
- `ios/App/App/AppDelegate.swift` — `@main` (bonus).
- `ios/App/App.xcodeproj/project.pbxproj` — `ENABLE_USER_SCRIPT_SANDBOXING = NO` ×2 (bonus).
- `node_modules/@capacitor/local-notifications/.../LocalNotificationsHandler.swift` — `.alert` → `.banner`+`.list` (Issue 4).
- `patches/@capacitor+local-notifications+7.0.6.patch` — **new**, persists Issue 4 fix.
- `package.json` — `patch-package` devDependency + `postinstall` script.
