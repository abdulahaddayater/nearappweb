# TapPay on NEAR

Phone-to-phone **NEAR** payments for **Android**. The receiver opens TapPay and types an amount in NEAR, the sender holds their phone
near it, confirms with fingerprint or face unlock, and the NEAR lands. Both screens show **Paid** within seconds.

- **The tap only carries a payment request** — who gets paid, how much NEAR, and a one-time ID. Money moves on NEAR, never over NFC.
- **No gas for users** — the sender signs a NEP-366 meta-transaction (`DelegateAction` with a single native NEAR `Transfer` to the receiver); the TapPay relayer submits it and pays the gas. The sender only needs the NEAR being paid.
- **Sign in with Google, Apple, email or a passkey through NEAR Auth** — no seed phrase.
- **NEAR only** — no USDC, USDT or other tokens.
- **Android only right now** — Android ↔ Android by NFC, with a QR fallback. **iPhone is not supported.**
- Android APK download: `downloads/tappay.apk` (existing Android build restored for download; installed UI may still say Halo).

Fresh TapPay build (Nov 1–14) reusing the tap-to-pay idea, not the old Halo code. Testnet prototype.

## What's in this repo
```
index.html                 landing page (interactive tap demo; uses assets/style.css + assets/app.js)
app/                       TapPay web app / PWA (receiver + sender flows, QR, Web NFC, biometric confirm)
  app.js  auth.js          flows; NEAR Auth adapter + WebAuthn biometric confirm + delegate signing hook
api/requests.js            POST create one-time payment request · GET status (pending → settling → paid)
api/relay.js               gasless relayer: validates the SignedDelegate matches the request exactly, pays gas
api/config.js              public client config (network, NEAR, demo mode)
lib/                       config (testnet defaults), request model, store (memory or KV)
scripts/dev-server.js      local server for static + /api
scripts/smoke-test.js      end-to-end demo-mode test
.well-known/assetlinks.json  Digital Asset Links for the TapPay Android app (passkeys) — fill in fingerprint
```

### Payment request (the only thing on the tap / QR)
```
https://<host>/app/#pay?id=<one-time id>&to=<receiver.testnet>&amt=<2.50>   (amount in NEAR)
```
The server is the source of truth for the request (amount in yoctoNEAR, expiry, status). The relayer refuses
anything except a single native NEAR `Transfer` to that receiver for exactly that amount, and each ID can
be settled once (replays get `409`).

## Run locally
```bash
npm install
npm run dev            # http://localhost:8080  (demo mode unless relayer env is set)
npm test               # smoke test: create request → relay → Paid, replay rejected
```
Biometric confirm and camera need a secure context: use `localhost` or deploy (Vercel) / tunnel for phones.

## Demo flow
1. Phone A (receiver): open `/app/`, sign in, **Receive**, type `2.50`, **Request payment**. A QR appears and the phone waits.
2. Phone B (sender): **Pay** → tap (native Android app) / **Scan QR** / open the QR with the camera app.
3. Phone B shows amount + receiver + "Network fee: paid by TapPay" → **Confirm with fingerprint** → NEAR Auth approval.
4. Relayer submits; both phones flip to **Paid ✓** (receiver via 1 s polling) with a NearBlocks testnet link.

Without relayer / NEAR Auth env vars the app runs in **demo mode**: sign-in creates a local profile and settlement is simulated (flagged in the UI and API as `simulated`).

## Environment variables (see `.env.example`)
| Var | Purpose |
|---|---|
| `RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY` | Funded testnet account that pays gas + storage. Server-only. Enables real settlement. |
| `NEAR_AUTH_URL`, `NEAR_AUTH_CLIENT_ID` | NEAR Auth hosted sign-in (Google / Apple / email / passkey). |
| `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_EXPLORER` | Testnet defaults. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV / Upstash for request state (needed on Vercel — memory store isn't shared across instances). |

## Integration points still needing external setup
- **NEAR Auth:** `app/auth.js` redirects to `NEAR_AUTH_URL/authorize` and reads `#auth?account_id=…&session=…` on return; real signing expects `window.nearAuth.signDelegate(...)` returning a base64 `SignedDelegate`. Confirm against the NEAR Auth SDK you're issued and adjust these two spots.
- **Native NFC (Android HCE):** browsers can't do phone-to-phone NFC card emulation. The TapPay Android app (package `com.tappay.near`) should emulate an NDEF tag (HCE) whose single URI record is the payment-request link above, and on the reading side open it in the same sender flow. Web NFC in Android Chrome can read/write NFC stickers only.
- **Relayer account:** create + fund a testnet account; get test NEAR for senders from the testnet faucet.

## Limitations
- **iPhone is not supported right now.** Both phones must be Android.
- The app has to be open on both phones.
- The demo runs on testnet. NEAR Auth on mainnet needs whitelisting.
- Each payment opens a short NEAR Auth approval screen, so confirming takes a few seconds.
- It's a prototype, not a licensed payment product: no KYC and no cash in or out.

## Tracks
- **08 Real-World Money** — in-person NEAR payments between people, with gasless meta transactions.
- **13 Open Innovation** — a new way to pay with crypto by bringing two phones together, with the chain hidden.

## Deploy
Vercel → import repo → framework "Other", no build command. Set the env vars above. `api/*.js` deploy as serverless functions.

## Android: run TapPay (Halo APK is deprecated)

The old **Halo APK is deprecated** — its source isn't available, and its "scan this QR with your phone" signup step doesn't work. Use the TapPay PWA:

1. Start the Android emulator (e.g. `emulator -avd Pixel_8_API_34`) or use a real Android phone.
2. Open **Chrome** and go to https://nearappweb.vercel.app/app/ (local dev from the emulator: `npm run dev`, then `http://10.0.2.2:8099/app/`).
3. Chrome menu ⋮ → **Add to Home screen** / **Install app**. It launches as "TapPay".
4. Type a username → **Create test account**. The account is created in-app (demo mode, no NEAR Auth env needed) — no second-phone QR.

QR codes are only used for payment requests; they encode `https://<app origin>/app/#pay?...` links, so scanning one with a phone camera opens TapPay and continues to the confirm screen (after sign-in if needed).
