# ✅ READY FOR XCODE — مملكة المعرفة · Knowledge Kingdom

This project has been prepared for direct iOS deployment with **Capacitor 7** and a
native Xcode project. Below is exactly what is ready, what you must do on your Mac, and
where to put your Apple Developer Team ID.

---

## What is ready

| Capability | Status | Notes |
|------------|:------:|-------|
| **Open directly in Xcode** | ✅ | Open `ios/App/App.xcworkspace` |
| **Run on Simulator** | ✅ | After `npm install && npm run build && npx cap sync ios` |
| **Run on a real iPhone** | ✅ | After setting your Team ID (signing) — see below |
| **Archive for App Store** | ✅ | Product ▸ Archive; bundle ID, icon, splash, deployment target all configured |

> Two steps **must** run on macOS because Linux/CI has no CocoaPods or Xcode:
> `pod install` (done automatically by `npx cap sync ios` on a Mac) and the final
> Xcode compile/archive. Everything else — the web build, the native project, signing
> placeholders, Info.plist, icons, and splash — is already generated and configured.

---

## Bundle identifier

```
com.yahya.knowledgekingdom
```
Already set in `capacitor.config.ts` and in `project.pbxproj` (Debug + Release).

---

## 🔑 Where to enter your Apple Developer Team ID

You can do this two ways — pick one.

### Option A — In Xcode (recommended, easiest)
1. Run `npx cap open ios` (or open `ios/App/App.xcworkspace`).
2. In the left sidebar select the **App** project → **App** target.
3. Open the **Signing & Capabilities** tab.
4. ✅ Check **Automatically manage signing**.
5. In the **Team** dropdown, choose your Apple Developer team
   (e.g. *"Yahya …  (ABCDE12345)"*). Xcode fills in the rest.

### Option B — Edit the placeholder in the project file
Open `ios/App/App.xcodeproj/project.pbxproj` and replace the **two** empty
placeholders with your 10‑character Team ID:

```diff
- DEVELOPMENT_TEAM = "";
+ DEVELOPMENT_TEAM = ABCDE12345;
```
(There is one in the `Debug` build config and one in the `Release` build config.)

> Your Team ID is shown at <https://developer.apple.com/account> →
> *Membership details* → **Team ID**.

---

## Run it (copy‑paste)

```bash
npm install
npm run build
npx cap sync ios      # runs pod install on macOS
npx cap open ios      # opens Xcode workspace
```

In Xcode: pick a Simulator or your iPhone → set Team → **Run (⌘R)**.
For submission: **Product ▸ Archive ▸ Distribute App**.

---

## Project facts

| | |
|---|---|
| Framework detected | Web React (React DOM), single‑file → wrapped with Capacitor 7 |
| Workspace to open | `ios/App/App.xcworkspace` |
| App name | Knowledge Kingdom (مملكة المعرفة) |
| Version | 7.0 (build 1) |
| Min iOS | 14.0 |
| Devices | iPhone + iPad (universal) |
| Orientation | Portrait + Landscape |
| Icon / Splash | Branded, generated, linked (App‑Store‑compliant, opaque) |
| Encryption compliance | `ITSAppUsesNonExemptEncryption = false` (no submission prompt) |

See **BUILD_REPORT.md** for the full list of changes, fixed errors, and warnings.
