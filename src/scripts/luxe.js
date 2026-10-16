// FCMOBILETOOLS — LUXE interaction layer.
// Global polish (progress bar, cursor light, reveal, ripple, toasts, confetti)
// plus account features (rank ladder, streak milestones, level-up celebration,
// shareable player card). Everything is additive and fails silently.

if (!window.__fcmtLuxe) {
  window.__fcmtLuxe = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const make = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  };
  const fmt = (n) => Number(n || 0).toLocaleString();

  /* ------------------------------------------------------------------ *
   * Toasts  —  window.fcToast('Saved', { type: 'success' | 'gold' | 'error' })
   * ------------------------------------------------------------------ */
  let toastHost;
  window.fcToast = (message, opts = {}) => {
    if (!toastHost) {
      toastHost = make('div', 'lx-toasts');
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
    const icons = { success: '✓', gold: '★', error: '!', info: '✦' };
    const type = opts.type || 'info';
    const t = make('div', 'lx-toast');
    t.dataset.type = type;
    t.innerHTML = `<i>${opts.icon || icons[type] || '✦'}</i><span></span>`;
    t.lastChild.textContent = message;
    toastHost.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 380);
    }, opts.duration || 2800);
  };

  /* ------------------------------------------------------------------ *
   * Confetti  —  window.fcConfetti()
   * ------------------------------------------------------------------ */
  window.fcConfetti = (opts = {}) => {
    if (reduce) return;
    const cv = make('canvas', 'lx-confetti');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (cv.width = innerWidth * dpr);
    const H = (cv.height = innerHeight * dpr);
    document.body.appendChild(cv);
    const colors = ['#4cc9ff', '#a8ecff', '#9a8cff', '#f6c453', '#ffe7a6', '#5cf0b4', '#ff7a9c'];
    const n = opts.count || 170;
    const ox = (opts.x ?? 0.5) * W;
    const oy = (opts.y ?? 0.35) * H;
    const parts = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = (6 + Math.random() * 13) * dpr;
      return {
        x: ox, y: oy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7 * dpr,
        w: (6 + Math.random() * 8) * dpr, h: (4 + Math.random() * 6) * dpr,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: colors[(Math.random() * colors.length) | 0],
        life: 1
      };
    });
    const t0 = performance.now();
    const step = (t) => {
      ctx.clearRect(0, 0, W, H);
      const k = (t - t0) / 3200;
      parts.forEach((p) => {
        p.vy += 0.34 * dpr; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (k < 1) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step);
  };

  /* ------------------------------------------------------------------ *
   * Ambient chrome: grain, scroll progress, cursor light, back-to-top
   * ------------------------------------------------------------------ */
  const boot = () => {
    document.documentElement.classList.add('lx-ready');
    document.body.appendChild(make('div', 'lx-grain'));

    const bar = make('div', 'lx-progress');
    document.body.appendChild(bar);
    const top = make('button', 'lx-top', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>');
    top.type = 'button';
    top.setAttribute('aria-label', 'Back to top');
    top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
    document.body.appendChild(top);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
        top.classList.toggle('on', scrollY > 900);
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (finePointer && !reduce) {
      const glow = make('div', 'lx-cursor');
      document.body.appendChild(glow);
      let gx = 0, gy = 0, raf = 0;
      addEventListener('pointermove', (e) => {
        gx = e.clientX; gy = e.clientY;
        glow.classList.add('on');
        if (!raf) raf = requestAnimationFrame(() => {
          glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
          raf = 0;
        });
      }, { passive: true });
      document.addEventListener('pointerleave', () => glow.classList.remove('on'));
    }
  };

  /* ------------------------------------------------------------------ *
   * Scroll reveal (opt-in list, skips elements that already animate)
   * ------------------------------------------------------------------ */
  const REVEAL = '.kpi-card,.guide-card,.feature-card,.insight-card,.tv-card,.match-card,.lp-card,.rx-card,.tx-card,.third-card,.mission-card,.rw-card,.side-card,.ledger-panel,.public-game-card,.dash-section-head,.lx-ladder,.article-card,.post-card';
  let io;
  const revealScan = (root = document) => {
    if (reduce || !('IntersectionObserver' in window)) return;
    io ||= new IntersectionObserver((entries) => {
      let i = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.style.setProperty('--lx-i', String(Math.min(i++, 8)));
        en.target.classList.add('lx-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll?.(REVEAL).forEach((el) => {
      if (el.dataset.lxR || el.closest('.acc-anim, .lx-reveal, [hidden]')) return;
      el.dataset.lxR = '1';
      el.classList.add('lx-reveal');
      io.observe(el);
    });
  };

  /* ------------------------------------------------------------------ *
   * Ripple on buttons
   * ------------------------------------------------------------------ */
  document.addEventListener('pointerdown', (e) => {
    if (reduce) return;
    const btn = e.target instanceof Element ? e.target.closest('.btn-primary,.btn-secondary,.submit-btn,.premium-button,.google-btn') : null;
    if (!btn) return;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const rp = make('span', 'lx-ripple');
    rp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    btn.appendChild(rp);
    setTimeout(() => rp.remove(), 700);
  }, { passive: true });

  /* Copy-link feedback */
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('#copyProfileUrlBtn') : null;
    if (b) window.fcToast('Profile link copied', { type: 'success' });
  });

  /* ------------------------------------------------------------------ *
   * PROFILE ENHANCEMENTS
   * ------------------------------------------------------------------ */
  const TIERS = [
    { name: 'Rookie', at: 1, icon: '⚽' },
    { name: 'Challenger', at: 5, icon: '🛡️' },
    { name: 'Pro', at: 10, icon: '⭐' },
    { name: 'Elite', at: 20, icon: '💎' },
    { name: 'Legend', at: 35, icon: '👑' }
  ];
  const FLAMES = [3, 7, 14, 30, 60, 100, 365];

  const readProfile = (hero) => {
    const txt = (s, r = document) => $(s, r)?.textContent?.trim() || '';
    const num = (s) => Number(String(txt(s)).replace(/[^\d]/g, '')) || 0;
    const lvl = Number((txt('.avatar-lvl', hero).match(/\d+/) || [0])[0]);
    const xpEl = document.querySelector('.kpi-card--xp [data-count]');
    const tkEl = document.querySelector('.kpi-card--tokens [data-count]');
    return {
      name: txt('h1', hero),
      handle: txt('.hero-handle strong', hero) || txt('.hero-handle', hero).split(/\s/)[0],
      level: lvl,
      rank: txt('.pill-gold', hero).replace(/^[^\w]+/, '') || 'Rookie',
      xp: xpEl ? Number(xpEl.dataset.count) : num('.xp-strip-numbers b'),
      tokens: tkEl ? Number(tkEl.dataset.count) : 0,
      streak: Number((txt('.kpi-card--streak strong').match(/\d+/) || [0])[0]),
      best: Number((txt('.kpi-card--streak .kpi-badge').match(/\d+/) || [0])[0]),
      avatar: $('.hero-avatar img', hero)?.src || '',
      initials: txt('.hero-avatar > span', hero)
    };
  };

  const addLadder = (hero, p) => {
    if (!p.level || $('.lx-ladder', hero)) return;
    let idx = 0;
    TIERS.forEach((t, i) => { if (p.level >= t.at) idx = i; });
    const next = TIERS[idx + 1];
    const frac = next ? (p.level - TIERS[idx].at) / (next.at - TIERS[idx].at) : 1;
    const prog = Math.min(100, ((idx + frac) / (TIERS.length - 1)) * 100);
    const head = next
      ? `<span><b>${next.at - p.level}</b> level${next.at - p.level === 1 ? '' : 's'} to <b>${next.name}</b></span>`
      : '<span><b>Max tier</b> — you are a Legend</span>';
    const rungs = TIERS.map((t, i) => `
      <div class="lx-rung ${i < idx ? 'done' : i === idx ? 'now' : ''}">
        <i>${t.icon}</i><small>${t.name}</small><em>Lv ${t.at}+</em>
      </div>`).join('');
    const el = make('div', 'lx-ladder', `
      <div class="lx-ladder-head"><strong>Rank ladder</strong>${head}</div>
      <div class="lx-rungs" style="--lx-prog:${prog}%">${rungs}</div>`);
    hero.appendChild(el);
  };

  const addStreakMeter = (p) => {
    const card = $('.kpi-card--streak');
    if (!card || $('.lx-meter', card)) return;
    const target = FLAMES.find((d) => d > p.streak) || FLAMES[FLAMES.length - 1];
    const prev = [...FLAMES].reverse().find((d) => d <= p.streak) || 0;
    const w = Math.max(4, Math.min(100, ((p.streak - prev) / (target - prev)) * 100));
    const m = make('div', 'lx-meter', `
      <div class="lx-meter-bar"><i style="--w:${w}%"></i></div>
      <small>Next flame: <b>${target}-day</b> streak · ${Math.max(0, target - p.streak)} to go</small>`);
    const link = $('.kpi-link', card);
    card.insertBefore(m, link || null);
  };

  /* Shareable player card (canvas → PNG) */
  const rr = (c, x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  const loadImg = (src) => new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

  const buildShareCard = async (p) => {
    const W = 1080, H = 1350;
    const cv = make('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const F = "'Space Grotesk','Inter',system-ui,sans-serif";

    let g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0d1c2b'); g.addColorStop(1, '#050b12');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const orb = (x, y, r, col) => {
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
    };
    orb(120, 160, 620, 'rgba(76,201,255,.38)');
    orb(980, 300, 560, 'rgba(154,140,255,.34)');
    orb(560, 1250, 640, 'rgba(246,196,83,.2)');

    c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 1;
    for (let i = 0; i < W; i += 54) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); }
    for (let i = 0; i < H; i += 54) { c.beginPath(); c.moveTo(0, i); c.lineTo(W, i); c.stroke(); }

    // frame
    const fg = c.createLinearGradient(0, 0, W, H);
    fg.addColorStop(0, 'rgba(76,201,255,.9)'); fg.addColorStop(.5, 'rgba(246,196,83,.7)'); fg.addColorStop(1, 'rgba(154,140,255,.9)');
    c.lineWidth = 3; c.strokeStyle = fg; rr(c, 40, 40, W - 80, H - 80, 54); c.stroke();

    c.fillStyle = '#a8ecff'; c.font = `800 26px ${F}`; c.textAlign = 'left';
    c.fillText('FCMOBILETOOLS', 96, 118);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.font = `600 22px ${F}`; c.textAlign = 'right';
    c.fillText('PLAYER CARD', W - 96, 118);

    // avatar
    const cx = W / 2, cy = 380, R = 150;
    const halo = c.createRadialGradient(cx, cy, R * .6, cx, cy, R * 2);
    halo.addColorStop(0, 'rgba(76,201,255,.5)'); halo.addColorStop(1, 'rgba(76,201,255,0)');
    c.fillStyle = halo; c.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.1)';
    c.beginPath(); c.arc(cx, cy, R + 22, 0, Math.PI * 2); c.stroke();
    const ring = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ring.addColorStop(0, '#4cc9ff'); ring.addColorStop(1, '#5cf0b4');
    c.strokeStyle = ring; c.lineCap = 'round';
    const pct = Math.min(.96, Math.max(.08, (p.xp % (Math.max(1, p.level) * 250)) / (Math.max(1, p.level) * 250)));
    c.beginPath(); c.arc(cx, cy, R + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); c.stroke();

    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
    const img = await loadImg(p.avatar);
    if (img) c.drawImage(img, cx - R, cy - R, R * 2, R * 2);
    else {
      const ag = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      ag.addColorStop(0, '#d6f6ff'); ag.addColorStop(.55, '#4cc9ff'); ag.addColorStop(1, '#7a8cff');
      c.fillStyle = ag; c.fillRect(cx - R, cy - R, R * 2, R * 2);
      c.fillStyle = '#04131c'; c.font = `800 120px ${F}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((p.initials || p.name.slice(0, 2)).toUpperCase(), cx, cy + 6);
    }
    c.restore(); c.textBaseline = 'alphabetic';

    // level badge
    const bw = 190, bh = 54;
    const bg = c.createLinearGradient(0, 0, 0, bh);
    bg.addColorStop(0, '#ffe9a8'); bg.addColorStop(1, '#f2b93b');
    c.fillStyle = bg; rr(c, cx - bw / 2, cy + R - 10, bw, bh, 27); c.fill();
    c.fillStyle = '#3b2a00'; c.font = `900 28px ${F}`; c.textAlign = 'center';
    c.fillText(`LEVEL ${p.level}`, cx, cy + R + 28);

    // name
    c.fillStyle = '#fff'; c.font = `800 84px ${F}`;
    let nm = p.name; while (c.measureText(nm).width > W - 200 && nm.length > 4) nm = nm.slice(0, -2);
    if (nm !== p.name) nm += '…';
    c.fillText(nm, cx, 690);
    c.fillStyle = '#8fd8ff'; c.font = `600 38px ${F}`; c.fillText(p.handle.startsWith('@') ? p.handle : '@' + p.handle, cx, 748);

    // rank pill
    c.font = `800 26px ${F}`;
    const rw = c.measureText(p.rank.toUpperCase()).width + 70;
    c.fillStyle = 'rgba(246,196,83,.16)'; rr(c, cx - rw / 2, 786, rw, 54, 27); c.fill();
    c.strokeStyle = 'rgba(246,196,83,.7)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffe7a6'; c.fillText('★  ' + p.rank.toUpperCase(), cx, 822);

    // stats
    const stats = [
      ['XP', fmt(p.xp), '#4cc9ff'],
      ['TOKENS', fmt(p.tokens), '#f6c453'],
      ['STREAK', p.streak + 'd', '#ff8a4c']
    ];
    const sw = 270, gap = 24, sx = (W - (sw * 3 + gap * 2)) / 2;
    stats.forEach(([label, val, col], i) => {
      const x = sx + i * (sw + gap);
      const sg = c.createLinearGradient(x, 900, x, 1110);
      sg.addColorStop(0, 'rgba(255,255,255,.08)'); sg.addColorStop(1, 'rgba(255,255,255,.02)');
      c.fillStyle = sg; rr(c, x, 900, sw, 210, 32); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = col; c.fillRect(x + 40, 900, sw - 80, 4);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `700 22px ${F}`; c.textAlign = 'center';
      c.fillText(label, x + sw / 2, 960);
      c.fillStyle = '#fff'; c.font = `800 ${val.length > 6 ? 48 : 62}px ${F}`;
      c.fillText(val, x + sw / 2, 1050);
    });

    c.fillStyle = 'rgba(255,255,255,.5)'; c.font = `600 26px ${F}`;
    c.fillText('fcmobiletools.online', cx, 1220);
    c.fillStyle = 'rgba(255,255,255,.28)'; c.font = `500 20px ${F}`;
    c.fillText('Fan-made · not affiliated with EA SPORTS FC Mobile', cx, 1262);
    return cv;
  };

  const addShare = (hero, p) => {
    const actions = $('.hero-actions', hero);
    if (!actions || $('.lx-share-btn', actions)) return;
    const btn = make('button', 'btn-secondary lx-share-btn',
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/></svg><span>Share Card</span>');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const cv = await buildShareCard(readProfile(hero));
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        if (!blob) throw new Error('blob');
        const file = new File([blob], `${p.handle.replace('@', '') || 'player'}-fcmobiletools.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] }) && /Mobi|Android/i.test(navigator.userAgent)) {
          await navigator.share({ files: [file], title: 'My FCMobiletools player card' });
        } else {
          const a = make('a');
          a.href = URL.createObjectURL(blob); a.download = file.name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          window.fcToast('Player card saved', { type: 'gold' });
        }
      } catch (err) {
        if (err?.name !== 'AbortError') window.fcToast('Could not create the card — try again', { type: 'error' });
      } finally { btn.disabled = false; }
    });
    const copy = $('#copyProfileUrlBtn', actions);
    actions.insertBefore(btn, copy ? copy.nextSibling : null);
  };

  const levelUp = (p) => {
    if (!p.level) return;
    try {
      const key = 'lx-last-level:' + (p.handle || 'me');
      const prev = Number(localStorage.getItem(key) || 0);
      localStorage.setItem(key, String(p.level));
      if (prev && p.level > prev) {
        setTimeout(() => {
          window.fcConfetti({ count: 220 });
          window.fcToast(`Level up! You reached Level ${p.level}`, { type: 'gold', duration: 4200 });
        }, 900);
      }
    } catch { /* storage blocked */ }
  };

  const enhanceHero = (hero) => {
    if (hero.dataset.lxDone) return;
    hero.dataset.lxDone = '1';
    hero.prepend(make('div', 'lx-orbs', '<i></i><i></i><i></i>'));
    if (finePointer) hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', e.clientX - r.left + 'px');
      hero.style.setProperty('--my', e.clientY - r.top + 'px');
    }, { passive: true });

    if ($('.xp-strip', hero)) { // signed-in profile only
      const p = readProfile(hero);
      addLadder(hero, p);
      addStreakMeter(p);
      addShare(hero, p);
      levelUp(p);
    }
  };

  const scan = () => {
    const hero = $('.prof-page .hero-card');
    if (hero) enhanceHero(hero);
    revealScan(document);
  };

  const start = () => {
    boot();
    scan();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
