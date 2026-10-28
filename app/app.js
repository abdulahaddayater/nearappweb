import QRCode from 'https://esm.sh/qrcode@1.5.4';
import { session, signIn, signOut, completeRedirect, confirmWithBiometrics, signTransferDelegate } from './auth.js';

const $ = (id) => document.getElementById(id);
const screens = ['s-signin', 's-home', 's-receive', 's-pay'];
const show = (id) => screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
const api = async (path, opts) => { const r = await fetch(path, opts); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; };
let cfg, poll;

function poller(id, onUpdate) {
  clearInterval(poll);
  poll = setInterval(async () => {
    try { const r = await api(`/api/requests?id=${encodeURIComponent(id)}`); onUpdate(r); if (r.status !== 'pending' && r.status !== 'settling') clearInterval(poll); } catch (_) {}
  }, 1000);
}
const paidHtml = (r) => `<span class="paid">Paid ✓</span><br><span class="small">${r.amount} NEAR → ${r.to}${r.txHash ? ` · <a href="${cfg.explorer || 'https://testnet.nearblocks.io'}/txns/${r.txHash}" target="_blank">tx</a>` : r.simulated ? ' · simulated (demo mode)' : ''}</span>`;

function home() {
  const s = session(); if (!s) return show('s-signin');
  $('who').textContent = s.accountId; show('s-home');
  const pending = sessionStorage.getItem('tappay-pending');
  if (pending) { sessionStorage.removeItem('tappay-pending'); openRequest(parseLink(pending)); }
}

// ---------- Receiver ----------
async function makeRequest() {
  const amount = $('amount').value.trim();
  try {
    const r = await api('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: session().accountId, amount }) });
    $('qr').src = await QRCode.toDataURL(r.uri = location.origin + '/app/' + r.uri.slice(r.uri.indexOf('#')), { margin: 1, width: 480 });
    $('r-meta').textContent = `Request ${r.id} · one-time · expires in ${Math.round((r.expiresAt - Date.now()) / 60000)} min`;
    $('req-out').classList.remove('hidden'); $('make-req').disabled = true;
    // Android Chrome: also offer the request over Web NFC (writes to a tag/sticker). Phone-to-phone
    // tap needs the native Android HCE client — see README.
    if ('NDEFReader' in window) $('r-hint').textContent += ' Web NFC available: tap a TapPay sticker to write this request.';
    poller(r.id, (u) => {
      if (u.status === 'paid') $('r-status').innerHTML = paidHtml(u), $('qr').classList.add('hidden');
      else if (u.status === 'settling') $('r-status').textContent = 'Payment landing…';
      else if (u.status !== 'pending') $('r-status').textContent = `Request ${u.status}`;
    });
  } catch (e) { alert(e.message); }
}

// ---------- Sender ----------
function parseLink(text) {
  const h = text.includes('#pay?') ? text.split('#pay?')[1] : null;
  return h ? Object.fromEntries(new URLSearchParams(h)) : null;
}
async function openRequest(p) {
  if (!p || !p.id) return ($('p-note').textContent = 'Not a TapPay request');
  try {
    const r = await api(`/api/requests?id=${encodeURIComponent(p.id)}`);
    if (r.status !== 'pending') return ($('p-note').textContent = `This request is ${r.status}`);
    show('s-pay'); $('p-scan').classList.add('hidden'); $('p-confirm').classList.remove('hidden');
    $('c-amount').textContent = `${r.amount} NEAR`; $('c-to').textContent = r.to; $('c-id').textContent = r.id;
    $('confirm').onclick = () => pay(r);
  } catch (e) { $('p-note').textContent = e.message; }
}
async function pay(r) {
  const st = $('p-status'); st.classList.remove('hidden');
  try {
    $('confirm').disabled = true; st.textContent = 'Confirm with fingerprint / face unlock…';
    await confirmWithBiometrics();
    st.textContent = 'Approving with NEAR Auth…';
    const signedDelegate = await signTransferDelegate(session(), r);
    st.textContent = 'Sending (gas paid by TapPay)…';
    $('p-confirm').classList.add('hidden');
    const out = await api('/api/relay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id, sender: session().accountId, signedDelegate }) });
    st.innerHTML = out.status === 'paid' ? paidHtml(out) : `Payment ${out.status}`;
  } catch (e) { st.textContent = `Failed: ${e.message}`; $('confirm').disabled = false; $('p-confirm').classList.remove('hidden'); }
}
async function scanQr() {
  if (!('BarcodeDetector' in window)) return ($('p-note').textContent = 'Use your camera app to scan the QR — it opens TapPay directly.');
  const v = $('cam'); v.classList.remove('hidden');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  v.srcObject = stream; await v.play();
  const det = new BarcodeDetector({ formats: ['qr_code'] });
  const tick = async () => {
    const [c] = await det.detect(v).catch(() => []);
    if (c) { stream.getTracks().forEach((t) => t.stop()); v.classList.add('hidden'); return openRequest(parseLink(c.rawValue)); }
    requestAnimationFrame(tick);
  };
  tick();
}
async function scanNfc() {
  if (!('NDEFReader' in window)) return ($('p-note').textContent = 'Web NFC is Android Chrome only. Use the TapPay Android app for phone-to-phone taps, or scan the QR.');
  const r = new NDEFReader(); await r.scan(); $('p-note').textContent = 'Hold near the receiver…';
  r.onreading = (ev) => { for (const rec of ev.message.records) if (rec.recordType === 'url' || rec.recordType === 'text') openRequest(parseLink(new TextDecoder().decode(rec.data))); };
}

// After sign-in, continue any payment link that opened the app (QR/NFC), otherwise go home.
function resume() {
  const p = sessionStorage.getItem('tappay-pending'); sessionStorage.removeItem('tappay-pending');
  const l = p && parseLink(p);
  if (l) { history.replaceState(null, '', '/app/'); openRequest(l); } else home();
}

// ---------- Wiring ----------
(async () => {
  cfg = await api('/api/config').catch(() => ({ network: 'testnet', demoMode: true }));
  $('net').textContent = cfg.network;
  if (cfg.demoMode) $('demo-banner').textContent = 'Demo mode: no relayer / NEAR Auth configured — payments are simulated. See README.';
  const redirected = completeRedirect();
  document.querySelectorAll('[data-provider]').forEach((b) => b.onclick = async () => {
    try { if (await signIn(b.dataset.provider, cfg, { email: $('email').value.trim(), username: $('username').value.trim() })) resume(); } catch (e) { $('auth-note').textContent = e.message; }
  });
  document.querySelectorAll('[data-home]').forEach((b) => b.onclick = () => { clearInterval(poll); home(); });
  $('signout').onclick = (e) => { e.preventDefault(); signOut(); home(); };
  $('go-receive').onclick = () => { show('s-receive'); $('req-out').classList.add('hidden'); $('make-req').disabled = false; $('qr').classList.remove('hidden'); $('r-status').textContent = 'Waiting for payment…'; $('amount').focus(); };
  $('go-pay').onclick = () => { show('s-pay'); $('p-scan').classList.remove('hidden'); $('p-confirm').classList.add('hidden'); $('p-status').classList.add('hidden'); };
  $('make-req').onclick = makeRequest;
  $('scan-qr').onclick = () => scanQr().catch((e) => $('p-note').textContent = e.message);
  $('scan-nfc').onclick = () => scanNfc().catch((e) => $('p-note').textContent = e.message);
  $('paste').onchange = () => openRequest(parseLink($('paste').value));
  if (redirected) return resume();
  const link = parseLink(location.href);
  if (link) { if (!session()) { show('s-signin'); $('auth-note').textContent = 'Sign in to pay this request.'; sessionStorage.setItem('tappay-pending', location.href); } else openRequest(link); }
  else home();
})();
