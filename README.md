# TapPay on NEAR

Phone-to-phone **NEAR** payments for **Android**. The receiver opens TapPay and types an amount in NEAR, the sender holds their phone
near it, confirms with fingerprint or face unlock, and the NEAR lands. Both screens show **Paid** within seconds.

- **The tap only carries a payment request** — who gets paid, how much NEAR, and a one-time ID. Money moves on NEAR, never over NFC.
- **No gas for users** — the sender signs a NEP-366 meta-transaction (`DelegateAction` with a single native NEAR `Transfer` to the receiver); the TapPay relayer submits it and pays the gas. The sender only needs the NEAR being paid.
- **Sign in with Google, Apple, email or a passkey through NEAR Auth** — no seed phrase.
- **NEAR only** — no USDC, USDT or other tokens.
- **Android only right now** — Android ↔ Android by NFC, with a QR fallback. **iPhone is not supported.**
- Android APK download: `downloads/tappay.apk` — TapPay Android app (`com.tappay.near`), built from `android/`.

Fresh TapPay build (Nov 1–14) reusing the tap-to-pay idea, not old code. Testnet prototype.

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
.well-known/assetlinks.json  Digital Asset Links for com.tappay.near (App Links + passkeys)
android/                   TapPay Android app: WebView host + NFC HCE payment-request tag (build.sh → downloads/tappay.apk)
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
| `RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY` | Funded testnet account that submits every payment and pays gas. Server-only. |
| `NEAR_AUTH_URL`, `NEAR_AUTH_CLIENT_ID` | NEAR Auth hosted sign-in (Google / Apple / email / passkey) issued for this app. |
| `NEAR_AUTH_SDK_URL` | Optional: NEAR Auth browser SDK script (default `<NEAR_AUTH_URL>/sdk.js`). |
| `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_EXPLORER` | Testnet defaults. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV / Upstash for request state (needed on Vercel — memory store isn't shared across instances). |
| `TAPPAY_DEMO_MODE=1` | Force simulation even when everything is configured. |

**Real mode turns on only when all four of `RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY`, `NEAR_AUTH_URL`, `NEAR_AUTH_CLIENT_ID` are set** (and `TAPPAY_DEMO_MODE` is not `1`). Otherwise everything stays in demo mode. `/api/config` reports `demoMode`.

## Real settlement setup (testnet)
1. **Relayer:** create a testnet account (e.g. `npx near-cli-rs account create-account sponsor-by-faucet-service tappay-relayer.testnet autogenerate-new-keypair save-to-keychain network-config testnet create`), fund it from the testnet faucet, and copy its full-access key `ed25519:...` into `RELAYER_PRIVATE_KEY` (Vercel env only — never commit it).
2. **NEAR Auth:** register the app with NEAR Auth, set redirect URI `https://nearappweb.vercel.app/app/#auth`, and put the issued URL + client ID in `NEAR_AUTH_URL` / `NEAR_AUTH_CLIENT_ID`. Mainnet needs NEAR Auth whitelisting; testnet is the demo.
3. **KV:** add Vercel KV / Upstash so request state survives across serverless instances.
4. Redeploy. The demo banner disappears; demo profiles are blocked from paying, so users sign in with NEAR Auth.

How a real payment settles:
- `app/auth.js` redirects to `NEAR_AUTH_URL/authorize`, reads `#auth?account_id=…&session=…` on return, loads the NEAR Auth SDK and calls `window.nearAuth.signDelegate({ session, network, receiverId, actions: [{ type: 'Transfer', deposit }] })`, which must return a base64 borsh NEP-366 `SignedDelegate` (string or `{ signedDelegate }`). If the SDK you're issued uses a different name/shape, adapt only `signTransferDelegate` / `loadNearAuthSdk`.
- `api/relay.js` decodes the `SignedDelegate`, requires sender match, exactly one native `Transfer` to the request's receiver for the exact yoctoNEAR amount, no self-pay, and an unexpired `maxBlockHeight`; then the relayer wraps it in a transaction (`signedDelegate` action) and pays gas. The one-time ID can settle once (`409` on replay). The chain verifies the sender's signature and nonce.

**Verify the real path:** set the four env vars, sign in on two Android phones, request 0.1 NEAR, tap, confirm. The Paid screen links a NearBlocks testnet tx whose signer is the relayer and whose inner action is a `Delegate` → `Transfer` from the sender. `npm test` covers the demo path plus the delegate validation rules and the demo/real switch (no network).

## Android app (`android/`)
- Package `com.tappay.near`, label **TapPay**, Android 10+.
- Hosts `https://nearappweb.vercel.app/app/` in a WebView. On **Receive**, the web app calls `TapPayAndroid.setRequest(uri)` and `PaymentRequestHceService` emulates an NFC Forum Type 4 tag (AID `D2760000850101`) with one NDEF URI record: the payment-request link.
- The sender's phone reads that NDEF link (system dispatch or foreground dispatch with TapPay open) and opens it in the sender confirm flow. QR links open the same way (App Link).
- Build: JDK 17 + Android SDK (`platforms;android-34`, `build-tools;34.0.0`), then `android/build.sh` → `downloads/tappay.apk`. It creates a debug keystore at `~/.tappay/tappay-debug.jks` if none exists and prints its SHA-256; put that into `.well-known/assetlinks.json`. Get it any time with `keytool -list -v -keystore ~/.tappay/tappay-debug.jks -storepass android -alias tappay`. The committed APK is debug-signed (prototype).

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

## Android: run TapPay
1. Download `tappay.apk` from the landing page on an Android phone (allow **Install unknown apps**) — or `adb install downloads/tappay.apk`.
2. Turn on NFC. Open TapPay on both phones and sign in (demo mode: type a username → **Create test account**).
3. Receiver: **Receive** → amount → **Request payment**. Sender: hold the phone near the receiver's, confirm, and both screens show **Paid**. QR is the fallback.
