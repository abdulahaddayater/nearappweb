// NEAR Auth adapter. Providers: google | apple | email | passkey. No seed phrase anywhere in the UX.
// Production: set NEAR_AUTH_URL + NEAR_AUTH_CLIENT_ID (exposed via /api/config). The hosted NEAR Auth flow
// creates/recovers the user's NEAR account and returns a session with a signer that can produce a
// NEP-366 SignedDelegate. TODO(near-auth): confirm the exact SDK/redirect contract when integrating; the
// redirect shape below is the integration point.
// Demo (no NEAR_AUTH_* configured): a local profile is created so the full tap → confirm → Paid loop can be shown.
const KEY = 'tappay-session';
export const session = () => JSON.parse(localStorage.getItem(KEY) || 'null');
export const signOut = () => localStorage.removeItem(KEY);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'user';

export async function signIn(provider, cfg, { email } = {}) {
  if (cfg.nearAuth && cfg.nearAuth.url && cfg.nearAuth.clientId) {
    const u = new URL('/authorize', cfg.nearAuth.url);
    u.search = new URLSearchParams({ client_id: cfg.nearAuth.clientId, provider, login_hint: email || '',
      network: cfg.network, redirect_uri: location.origin + '/app/#auth' });
    location.href = u.toString();
    return null;
  }
  let name;
  if (provider === 'passkey') {
    await createPasskey('tappay-user');
    name = 'passkey-' + Math.random().toString(36).slice(2, 7);
  } else if (provider === 'email') {
    if (!email || !email.includes('@')) throw new Error('Enter your email');
    name = slug(email.split('@')[0]);
  } else name = `${provider}-${Math.random().toString(36).slice(2, 7)}`;
  const s = { accountId: `${name}.tappay-demo.${cfg.network}`, provider, demo: true, at: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

// Handle the NEAR Auth redirect back (#auth?account_id=...&session=...).
export function completeRedirect() {
  if (!location.hash.startsWith('#auth')) return null;
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  if (!q.get('account_id')) return null;
  const s = { accountId: q.get('account_id'), provider: q.get('provider') || 'near-auth', token: q.get('session'), demo: false, at: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(s));
  history.replaceState(null, '', '/app/');
  return s;
}

// --- Biometric confirm (Face ID / fingerprint) via WebAuthn user verification ---
const CRED = 'tappay-cred';
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function createPasskey(user) {
  if (!window.PublicKeyCredential) throw new Error('Passkeys are not supported on this browser');
  const c = await navigator.credentials.create({ publicKey: {
    challenge: rnd(32), rp: { name: 'TapPay' }, user: { id: rnd(16), name: user, displayName: 'TapPay' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' } } });
  localStorage.setItem(CRED, b64(c.rawId));
}

// Returns true when the user verified with biometrics (or the device's screen lock).
export async function confirmWithBiometrics() {
  if (!window.PublicKeyCredential) return window.confirm('Biometrics unavailable in this browser. Approve payment?');
  if (!localStorage.getItem(CRED)) await createPasskey('tappay-user');
  await navigator.credentials.get({ publicKey: { challenge: rnd(32), userVerification: 'required',
    allowCredentials: [{ type: 'public-key', id: unb64(localStorage.getItem(CRED)) }] } });
  return true;
}

// Produce a base64 SignedDelegate (NEP-366) for ft_transfer. Real signing comes from the NEAR Auth session.
export async function signTransferDelegate(s, req) {
  if (s.demo) return null; // demo: server is in simulation mode
  if (!window.nearAuth || !window.nearAuth.signDelegate)
    throw new Error('NEAR Auth signer not loaded — see README "NEAR Auth integration"');
  return window.nearAuth.signDelegate({ session: s.token, receiverId: req.token, actions: [{
    type: 'FunctionCall', methodName: 'ft_transfer', deposit: '1', gas: '30000000000000',
    args: { receiver_id: req.to, amount: req.units, memo: `tappay:${req.id}` } }] });
}
