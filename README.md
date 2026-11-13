# Halo landing site

Static site (plain HTML/CSS/JS, no build step). Deploys to Vercel as-is.

```
index.html              page
assets/style.css        design system (light/black, NEAR green #00EC97)
assets/app.js           theme toggle, scroll reveal, count-up stats, NFC tap simulation
assets/favicon.svg
downloads/halo.apk      the Android app (arm64, debug-signed, testnet only)
.well-known/assetlinks.json   Digital Asset Links for passkeys (served as application/json via vercel.json)
vercel.json             headers: assetlinks JSON, APK content-type/disposition, caching
scripts/update-apk.sh   swap in a new APK and rewrite version / size / SHA-256 on the page
```

## Run locally
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy to Vercel
1. Push this folder (the repo root = this folder) to GitHub.
2. Vercel → *Add New Project* → import the repo. Framework preset **Other**, no build command, output directory = repo root.
3. Deploy. Note your domain, e.g. `halo-yourname.vercel.app`.
4. **Passkeys:** the app verifies the domain through `https://<domain>/.well-known/assetlinks.json`.
   - `assetlinks.json` already lists package `com.halopay.near` and the SHA-256 of the debug key used to sign `halo.apk`
     (`A8:93:A0:03:…:9B:67:20`). If you re-sign with another key, replace the fingerprint.
   - In the app: *Settings → Advanced → Passkey domain* → enter your Vercel domain → *Save & check domain*.
     (Or change `PASSKEY_RP_ID` in `app/build.gradle.kts` and rebuild.) Until the domain checks out, the app keeps
     the passkey switch off and accounts work normally.
5. Verify: `curl -i https://<domain>/.well-known/assetlinks.json` → `200`, `content-type: application/json`.

## Update the APK
```bash
scripts/update-apk.sh /path/to/new/halo.apk 1.0.1-hackathon   # version arg optional
git add -A && git commit -m "Halo 1.0.1" && git push            # Vercel redeploys
```
The script copies the file to `downloads/halo.apk` and rewrites the version, size and SHA-256 shown on the page
from the actual file. Replace the placeholder GitHub link in `index.html` (already set to abdulahaddayater/nearappweb).

## NearTap 1.3.1: scanner fix (patched APK)
The app source isn't in this repo, so 1.3.1 is built by patching the 1.3.0 APK:
`android-patch/scanner-fix/build.sh <neartap-1.3.0.apk> downloads/halo.apk`, then `scripts/update-apk.sh downloads/halo.apk 1.3.1-hackathon`.

- **Pay opens the QR scanner straight away** when the phone can't tap (no NFC, or NFC turned off). Phones with NFC on still get *Hold near the other phone* with **Scan QR instead**.
- **"Allow camera" works after a denial.** Before, once the camera had been denied, Android stopped showing the permission dialog and the button did nothing, so the scanner never appeared. Now it opens NearTap's system settings, and coming back with the camera allowed starts the scanner.
- Signed with a new debug key (SHA-256 `8D:85:8F:E9:…:23:4F`, added to `assetlinks.json` next to the old one). Updating from 1.3.0 needs an uninstall first: back up the account key in Settings before that.
- Same fix belongs in the Kotlin source (`PayScreen` scanner state and the camera-permission button) when you next build from source.
