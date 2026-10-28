# TapPay on NEAR

Phone-to-phone USDC payments on NEAR. The receiver opens TapPay and types an amount, the sender holds their phone
near it, confirms with Face ID or fingerprint, and the USDC lands. Both screens show **Paid** within seconds.

- **The tap only carries a payment request** — who gets paid, how much, which token, and a one-time ID. Money moves on NEAR, never over NFC.
- **No gas for users** — the sender signs a NEP-366 meta-transaction (`DelegateAction` → `ft_transfer` on USDC); the TapPay relayer submits it and pays the fee. Neither phone needs NEAR tokens. The relayer also covers the receiver's USDC storage registration.
- **Sign in with Google, Apple, email or a passkey through NEAR Auth** — no seed phrase.
- **Android ↔ Android and iPhone ↔ Android** by NFC; **iPhone ↔ iPhone** uses a QR fallback.
- **Stretch (not shipped):** payout on Base / Arbitrum / Solana via NEAR Intents — see `lib/intents.js`.

Fresh TapPay build (Nov 1–14) reusing the tap-to-pay idea, not the old Halo code. Testnet prototype.

## What's in this repo
```
index.html                 landing page
app/                       TapPay web app / PWA (receiver + sender flows, QR, Web NFC, biometric confirm)
  app.js  auth.js          flows; NEAR Auth adapter + WebAuthn biometric confirm + delegate signing hook
api/requests.js            POST create one-time payment request · GET status (pending → settling → paid)
api/relay.js               gasless relayer: validates the SignedDelegate matches the request exactly, pays gas
api/config.js              public client config (network, token, demo mode)
lib/                       config (testnet defaults), request model, store (memory or KV), intents stub
scripts/dev-server.js      local server for static + /api
scripts/smoke-test.js      end-to-end demo-mode test
.well-known/assetlinks.json  Digital Asset Links for the TapPay Android app (passkeys) — fill in fingerprint
```

### Payment request (the only thing on the tap / QR)
```
https://<host>/app/#pay?id=<one-time id>&to=<receiver.testnet>&amt=<2.50>&tok=usdc.fakes.testnet
```
The server is the source of truth for the request (amount in base units, expiry, status). The relayer refuses
anything except a single `ft_transfer` to that receiver for that amount with memo `tappay:<id>`, and each ID can
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
3. Phone B shows amount + receiver + "Network fee: paid by TapPay" → **Confirm with Face ID / fingerprint** → NEAR Auth approval.
4. Relayer submits; both phones flip to **Paid ✓** (receiver via 1 s polling) with a NearBlocks testnet link.

Without relayer / NEAR Auth env vars the app runs in **demo mode**: sign-in creates a local profile and settlement is simulated (flagged in the UI and API as `simulated`).

## Environment variables (see `.env.example`)
| Var | Purpose |
|---|---|
| `RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY` | Funded testnet account that pays gas + storage. Server-only. Enables real settlement. |
| `NEAR_AUTH_URL`, `NEAR_AUTH_CLIENT_ID` | NEAR Auth hosted sign-in (Google / Apple / email / passkey). |
| `USDC_CONTRACT` | Defaults to `usdc.fakes.testnet` (USDC test, 6 decimals). |
| `NEAR_NETWORK`, `NEAR_RPC_URL`, `NEAR_EXPLORER` | Testnet defaults. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel KV / Upstash for request state (needed on Vercel — memory store isn't shared across instances). |

## Integration points still needing external setup
- **NEAR Auth:** `app/auth.js` redirects to `NEAR_AUTH_URL/authorize` and reads `#auth?account_id=…&session=…` on return; real signing expects `window.nearAuth.signDelegate(...)` returning a base64 `SignedDelegate`. Confirm against the NEAR Auth SDK you're issued and adjust these two spots.
- **Native NFC (Android HCE):** browsers can't do phone-to-phone NFC card emulation. The TapPay Android app (package `com.tappay.near`) should emulate an NDEF tag (HCE) whose single URI record is the payment-request link above, and on the reading side open it in the same sender flow. iPhone reads that tag with Core NFC. Web NFC in Android Chrome can read/write NFC stickers only.
- **Relayer account:** create + fund a testnet account; get USDC (test) for senders from the testnet faucet.
- **Intents (stretch):** `lib/intents.js` is a stub; disabled because NEAR Intents has no testnet.

## Limitations
- iPhone can't be the tapped side, because Apple restricts this to apps with a commercial entitlement. So iPhone ↔ iPhone uses QR.
- Every tap pair needs one Android phone with NFC.
- The app has to be open on both phones.
- The demo runs on testnet. NEAR Auth on mainnet needs whitelisting, and NEAR Intents has no testnet.
- Each payment opens a short NEAR Auth approval screen, so confirming takes a few seconds.
- It's a prototype, not a licensed payment product: no KYC and no cash in or out.

## Tracks
- **08 Real-World Money** — in-person stablecoin payments between people, with gasless meta transactions.
- **13 Open Innovation** — a new way to pay with crypto by bringing two phones together, with the chain hidden.
- **03 Privacy & Private AI** — only if the stretch ships: private cross-chain payouts using Confidential Intents.

## Deploy
Vercel → import repo → framework "Other", no build command. Set the env vars above. `api/*.js` deploy as serverless functions.
