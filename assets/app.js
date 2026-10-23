(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // theme
  $('#theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('halo-theme', next);
  });

  // nav shadow
  const nav = $('#nav'); const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // reveal
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // count-up stats
  const fmt = (n, dec) => n.toFixed(dec || 0);
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    const render = v => { el.innerHTML = pre + fmt(v, dec) + '<sup>' + suf + '</sup>'; };
    if (reduce) return render(to);
    const t0 = performance.now(), dur = 1400;
    (function step(t) { const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3); render(to * eased); if (p < 1) requestAnimationFrame(step); })(t0);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => { el.innerHTML = (el.dataset.pre || '') + fmt(0, +el.dataset.dec) + '<sup>' + (el.dataset.suf || '') + '</sup>'; cio.observe(el); });

  // copy hash
  $('#copyHash').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText($('#hash').textContent.trim()); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select & copy'; }
    setTimeout(() => e.target.textContent = 'Copy', 1800);
  });

  // pseudo-QR (decorative sample, not a real code)
  $$('[data-qr]').forEach(q => {
    const n = 25; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const finder = (x, y) => { for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const dx = x - ox, dy = y - oy; if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5)) ? 1 : 0; }
      for (const [ox, oy] of [[0, 0], [n - 8, 0], [0, n - 8]]) { const dx = x - ox, dy = y - oy; if (dx >= -1 && dx < 8 && dy >= -1 && dy < 8) return 0; } return -1; };
    let h = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const f = finder(x, y); const on = f === -1 ? rnd() > .52 : f === 1; h += '<i class="' + (on ? '' : 'o') + '"></i>'; }
    q.innerHTML = h;
  });

  // tap simulation
  const stage = $('#stage'), outer = $('#stageOuter'), W = 700, H = 520;
  const fit = () => { const s = Math.min(1, outer.clientWidth / W); stage.style.transform = 'scale(' + s + ')'; outer.style.height = (H * s) + 'px'; };
  fit(); addEventListener('resize', fit);
  const seq = [['idle', 1500], ['approach', 1400], ['tap', 1500], ['auth', 1500], ['send', 1300], ['done', 3200], ['leave', 1200]];
  const tl = $$('#timeline span'); let run = 0, started = false;
  const setState = s => {
    stage.dataset.s = s; tl.forEach(t => t.classList.toggle('on', t.dataset.t === s));
    $$('.s-check', stage).forEach(c => { c.classList.remove('go'); if (s === 'done') { void c.getBoundingClientRect(); c.classList.add('go'); } });
    const b = $('#pSend .screen'); if (s === 'tap') { b.classList.remove('buzz'); void b.offsetWidth; b.classList.add('buzz'); if (navigator.vibrate) navigator.vibrate(30); }
  };
  const play = async () => {
    const id = ++run;
    while (id === run) {
      for (const [s, ms] of seq) { if (id !== run) return; setState(s); await new Promise(r => setTimeout(r, reduce && s !== 'done' ? Math.min(ms, 600) : ms)); }
    }
  };
  new IntersectionObserver(es => { if (es[0].isIntersecting && !started) { started = true; play(); } }, { threshold: .25 }).observe(outer);
  $('#replay').addEventListener('click', () => { setState('idle'); started = true; play(); });
  $$('.amt').forEach(b => b.addEventListener('click', () => {
    $$('.amt').forEach(x => x.classList.toggle('on', x === b));
    $$('[data-amt]').forEach(a => a.textContent = b.dataset.v);
    setState('idle'); started = true; play();
  }));
})();
