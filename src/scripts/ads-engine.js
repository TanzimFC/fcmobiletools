// Browser side of the ads engine. Loaded only on pages that may show ads (see AdSlots.astro).
//
// Order of play for each slot:
//   1. A paid sponsor ad that matches the page, if one exists.
//   2. The ad network (AdSense), only when approved, enabled, consented where required,
//      and the page has enough content plus a configured ad unit.
//   3. A house ad (our own promos), picked by weight and recent performance.
//   4. Nothing. The ad system never blocks access to the tool or page.
// House and sponsor promotions do not depend on consent to optional ad storage or third-party requests.
// Inline ads load below the fold; the desktop tool rail has reserved space to avoid layout shifts.
import css from '../styles/ads.css?inline';
import { AD_SLOTS, SLOT_SIZES, slotsForPageType } from '../config/adSlots.js';
import { chooseCreative, blockers, pageBudget, networkAllowed } from '../lib/adsCore.js';

const root = document.getElementById('fcmtAdsRoot');

const COPY = {
  en: { hide: 'Hide this promotion', hidden: 'Hidden for {n} days.', hiddenSession: 'Hidden for this visit. It may appear again next time.', undo: 'Undo', network: 'Advertisement', done: 'Done. You will get these alerts.', busy: 'One moment' },
  id: { hide: 'Sembunyikan promosi ini', hidden: 'Disembunyikan selama {n} hari.', hiddenSession: 'Disembunyikan selama kunjungan ini. Promosi dapat muncul lagi saat Anda kembali.', undo: 'Urungkan', network: 'Iklan', done: 'Selesai. Anda akan menerima notifikasi ini.', busy: 'Sebentar' },
  'pt-BR': { hide: 'Ocultar esta promoção', hidden: 'Oculto por {n} dias.', hiddenSession: 'Oculto nesta visita. A promoção pode aparecer novamente na próxima visita.', undo: 'Desfazer', network: 'Publicidade', done: 'Pronto. Você receberá esses alertas.', busy: 'Um momento' },
  bn: { hide: 'এই প্রচার লুকান', hidden: '{n} দিনের জন্য লুকানো হয়েছে।', hiddenSession: 'এই ভিজিটে লুকানো হয়েছে। পরেরবার আবার দেখা যেতে পারে।', undo: 'ফিরিয়ে আনুন', network: 'বিজ্ঞাপন', done: 'হয়েছে। আপনি এই অ্যালার্টগুলো পাবেন।', busy: 'একটু অপেক্ষা করুন' }
};

const KEYS = { state: 'fcmt:ads:state:v1', views: 'fcmt:ads:views:v1', config: 'fcmt:ads:config:v1', pv: 'fcmt:ads:pv:v1' };
const DAY = 86400000;

async function boot() {
  const params = new URLSearchParams(location.search);
  const debug = params.get('adsdebug') === '1' || safeGet(localStorage, 'fcmt:ads:debug') === '1';
  const pageType = root.dataset.pageType;
  const toolRail = document.querySelector('[data-ad-anchor="tool-sidebar"]');
  const setToolRail = (enabled) => {
    if (!toolRail) return;
    const layout = toolRail.closest('.fcmt-content-layout');
    const placeholder = toolRail.querySelector('[data-ad-placeholder]');
    toolRail.hidden = !enabled;
    if (layout) layout.classList.toggle('fcmt-content-layout--ads-off', !enabled);
    if (placeholder) placeholder.hidden = !enabled;
  };
  const locale = COPY[root.dataset.locale] ? root.dataset.locale : 'en';
  const t = COPY[locale];
  const englishPath = (window.FCMT_I18N?.englishPath?.() || location.pathname).replace(/\/+$/, '') || '/';

  const config = await loadConfig();
  if (!config || !config.settings?.enabled) {
    setToolRail(false);
    return log(debug, 'Ads are switched off.');
  }
  const settings = config.settings;
  const views = bumpPageViews();
  const adFree = () => settings.adFreeForPremium && window.FCMT_ADFREE === true;
  if (adFree()) {
    setToolRail(false);
    return log(debug, 'Ad free visitor.');
  }
  setToolRail(true);

  const content = document.getElementById('content');
  const words = countWords(content);
  const device = matchMedia('(max-width: 719px)').matches ? 'mobile' : 'desktop';
  const paragraphs = content ? content.querySelectorAll('p').length : 0;
  const budget = debug ? 6 : pageBudget(settings, { pageType, paragraphs, words });
  if (budget <= 0) return log(debug, 'No ad budget for this page.');

  injectStyle();
  const shownIds = [];
  let shown = 0;
  const events = createEvents(pageType);
  window.addEventListener('fcmobiletools:consent-updated', (event) => {
    if (event.detail?.advertising !== false) return;
    document.querySelectorAll('.fcmt-ad-slot[data-ad-network="1"]').forEach((host) => {
      const slotId = host.dataset.adSlot;
      host.removeAttribute('data-ad-network');
      host.replaceChildren();
      const fallback = chooseCreative(config.creatives, makeContext(slotId), readState(), settings);
      if (fallback) renderCreative(host, fallback, slotId);
      else {
        host.remove();
        if (slotId === 'tool-sidebar') {
          const placeholder = toolRail?.querySelector('[data-ad-placeholder]');
          if (placeholder) placeholder.hidden = false;
        }
      }
    });
  });
  const nextOrder = ['tool-sidebar', 'article-early', 'article-mid', 'home-mid', 'page-mid', 'list-mid', 'tool-result', 'article-end', 'page-end'];
  const plan = slotsForPageType(pageType)
    .filter((slot) => settings.slots?.[slot.id]?.enabled !== false && slot.devices.includes(device))
    .sort((a, b) => nextOrder.indexOf(a.id) - nextOrder.indexOf(b.id));

  const candidates = [];
  for (const slot of plan) {
    const found = findAnchor(slot.id, settings);
    if (found) candidates.push({ slot, ...found });
  }
  log(debug, 'Planned slots', candidates.map((c) => c.slot.id));

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const item = entry.target.__fcmtSlot;
      io.unobserve(entry.target);
      if (!item || item.done) continue;
      item.done = true;
      if (shown >= budget) continue;
      const rect = entry.target.getBoundingClientRect();
      // Never insert something that would shove content the visitor can already see.
      if (!debug && item.slot.id !== 'tool-sidebar' && rect.bottom <= window.innerHeight + 8) { log(debug, item.slot.id + ': anchor already on screen, skipped'); continue; }
      if (fill(item)) shown += 1;
    }
  }, { rootMargin: '0px 0px 700px 0px', threshold: 0 });

  for (const item of candidates) {
    item.anchor.__fcmtSlot = item;
    io.observe(item.anchor);
  }

  function fill(item) {
    const ctx = makeContext(item.slot.id);
    const state = readState();
    const creatives = config.creatives;
    const pick = chooseCreative(creatives, ctx, state, settings);
    if (debug) explain(item.slot.id, creatives, ctx, state);

    const useNetwork = !(pick && pick.kind === 'sponsor') && networkAllowed(settings, {
      slot: item.slot.id, consent: hasAdvertisingConsent(), words, viewsThisSession: views, adFree: adFree()
    }) && Math.random() * 100 < (settings.adsense.share ?? 100);

    if (!pick && !useNetwork) return false;
    const host = makeHost(item);
    if (useNetwork) {
      host.dataset.adNetwork = '1';
      renderNetwork(host, item.slot, settings, events, () => {
        // Nothing came back from the network: swap in our own ad if one qualifies.
        host.removeAttribute('data-ad-network');
        const fallback = chooseCreative(creatives, makeContext(item.slot.id), readState(), settings);
        host.replaceChildren();
        if (fallback) renderCreative(host, fallback, item.slot.id);
        else {
          host.remove();
          if (item.slot.id === 'tool-sidebar') {
            const placeholder = item.anchor.querySelector('[data-ad-placeholder]');
            if (placeholder) placeholder.hidden = false;
          }
        }
      });
      return true;
    }
    renderCreative(host, pick, item.slot.id);
    return true;
  }

  function makeContext(slotId) {
    const push = window.FCPush;
    const pushOn = Boolean(push && push.state?.() === 'enabled');
    return {
      slot: slotId, pageType, path: englishPath, locale, device,
      signedIn: isSignedIn(), pushOn, topics: pushOn ? (push.prefs?.() || {}) : {},
      now: Date.now(), shownIds
    };
  }

  function makeHost(item) {
    const host = document.createElement('div');
    host.className = 'fcmt-ad-slot';
    host.dataset.adSlot = item.slot.id;
    host.dataset.context = item.context;
    host.dataset.size = item.slot.size || SLOT_SIZES[item.slot.id] || 'compact';
    if (debug) host.dataset.debug = '1';
    if (item.context === 'list') { host.style.gridColumn = '1 / -1'; host.style.flex = '0 0 100%'; }
    if (item.slot.id === 'tool-sidebar') {
      const placeholder = item.anchor.querySelector('[data-ad-placeholder]');
      if (placeholder) placeholder.hidden = true;
      item.anchor.append(host);
    } else {
      item.anchor.insertAdjacentElement('afterend', host);
      alignHost(host, item);
    }
    return host;
  }

  // Line every ad up with the page's own content edge. Pages use different wrappers (some are
  // 1160px wide, tool pages sit in a narrower column), so measure instead of guessing a width.
  const WRAP = '.hx-wrap, .sys-wrap, .directory-wrap, .wrap, [class$="-wrap"], [class*="container"]';
  const aligned = new Set();

  // The page's real content edge: the widest container around the main heading that is still
  // narrower than the screen. Works on any page without knowing its class names.
  function pageEdge() {
    const heading = document.querySelector('#content h1, main h1, h1');
    if (!heading) return null;
    let node = heading;
    let best = null;
    while (node.parentElement && node.parentElement !== document.body) {
      const parent = node.parentElement;
      if (parent.matches('#content, main, .fcmt-content-layout')) break;
      const width = parent.getBoundingClientRect().width;
      if (width >= innerWidth - 8) break;
      if (width >= 240) best = parent;
      node = parent;
    }
    return best;
  }

  function alignHost(host, item) {
    if (item.context === 'list' || item.context === 'inline') return;
    const apply = () => {
      if (!host.isConnected) return;
      const parent = host.parentElement;
      if (!parent) return;
      const anchor = item.anchor;
      let ref = anchor.matches?.(WRAP) ? anchor : (anchor.querySelector?.(WRAP) || null);
      if (!ref && anchor.getBoundingClientRect().width < innerWidth - 8) ref = anchor;
      if (!ref) ref = pageEdge();
      if (!ref) return;
      const a = ref.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      if (a.width < 240) return;
      host.style.width = Math.round(a.width) + 'px';
      host.style.maxWidth = '100%';
      host.style.marginInline = Math.max(0, Math.round(a.left - p.left)) + 'px 0';
      host.dataset.aligned = '1';
    };
    apply();
    aligned.add(apply);
  }
  let alignFrame = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(alignFrame);
    alignFrame = requestAnimationFrame(() => aligned.forEach((fn) => fn()));
  }, { passive: true });

  // Artwork sets live at /assets/ads/<name>-wide|card|square.svg and contain no text.
  const ART_SET = /^\/assets\/ads\/([a-z0-9-]+)$/;
  const SLOT_SIZE = SLOT_SIZES;
  // [artwork on wide screens, artwork on phones, then width and height of each]
  const ART_FILES = {
    hero: ['wide', 'card', 1200, 400, 800, 450],
    compact: ['square', 'card', 400, 400, 800, 450],
    sidebar: ['square', 'square', 400, 400, 400, 400],
    strip: ['wide', 'square', 1200, 400, 400, 400],
    banner: ['wide', 'square', 1200, 400, 400, 400],
    square: ['square', 'square', 400, 400, 400, 400],
    rectangle: ['card', 'card', 800, 450, 800, 450]
  };
  function artPicture(name, size) {
    const [wide, small, ww, wh, sw, sh] = ART_FILES[size] || ART_FILES.compact;
    const picture = document.createElement('picture');
    picture.className = 'fcmt-ad-art';
    const source = document.createElement('source');
    source.media = '(min-width: 720px)';
    source.srcset = '/assets/ads/' + name + '-' + wide + '.svg';
    const img = document.createElement('img');
    img.src = '/assets/ads/' + name + '-' + small + '.svg';
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = sw; img.height = sh;
    img.addEventListener('error', () => { picture.closest('.fcmt-ad')?.classList.remove('fcmt-ad--art'); picture.remove(); });
    picture.append(source, img);
    return picture;
  }

  function renderCreative(host, c, slotId) {
    shownIds.push(c.id);
    const aside = document.createElement('aside');
    aside.className = 'fcmt-ad';
    aside.dataset.accent = c.accent || 'cyan';
    aside.dataset.kind = c.kind;
    aside.setAttribute('aria-label', c.kind === 'sponsor' ? 'Sponsored' : 'Promotion');
    const saveData = navigator.connection?.saveData === true;
    const art = saveData ? null : ART_SET.exec(c.img || '');
    const hasMedia = Boolean(c.img) && !saveData && !art;
    if (art) {
      aside.classList.add('fcmt-ad--art');
      aside.dataset.size = SLOT_SIZE[slotId] || 'compact';
      aside.append(artPicture(art[1], aside.dataset.size));
    } else if (hasMedia) {
      aside.dataset.hasMedia = '1';
      const media = el('div', 'fcmt-ad-media');
      const img = document.createElement('img');
      img.src = c.img; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 112; img.height = 112;
      media.append(img);
      aside.append(media);
    }
    const main = el('div', 'fcmt-ad-main');
    const meta = el('div', 'fcmt-ad-meta');
    const badge = el('span', 'fcmt-ad-badge');
    badge.textContent = c.kind === 'sponsor' && c.sponsor ? (c.badge || 'Sponsored') + ' · ' + c.sponsor : c.badge;
    const close = el('button', 'fcmt-ad-x');
    close.type = 'button'; close.setAttribute('aria-label', t.hide); close.title = t.hide; close.textContent = '\u00d7';
    if (art) { meta.append(badge); aside.append(close); } else meta.append(badge, close);
    const title = el('p', 'fcmt-ad-title'); title.textContent = c.headline;
    main.append(meta, title);
    if (c.body) { const body = el('p', 'fcmt-ad-body'); body.textContent = c.body; main.append(body); }
    const actions = el('div', 'fcmt-ad-actions');
    const cta = c.action?.type === 'push' ? el('button', 'fcmt-ad-cta') : el('a', 'fcmt-ad-cta');
    cta.textContent = c.cta;
    if (c.action?.type === 'push') cta.type = 'button';
    else {
      cta.href = c.url;
      if (/^https?:/i.test(c.url)) { cta.target = '_blank'; cta.rel = (c.kind === 'sponsor' ? 'sponsored nofollow ' : '') + 'noopener'; }
    }
    actions.append(cta);
    if (art) { main.append(actions); aside.append(main); } else aside.append(main, actions);
    if (art && c.kind === 'house' && c.action?.type !== 'push') aside.dataset.whole = '1';
    host.replaceChildren(aside);

    watchView(aside, c, slotId);
    cta.addEventListener('click', () => {
      events.add(c.id, slotId, 'click', true);
      markClicked(c.id);
      if (c.action?.type === 'push') handlePush(c, cta, actions, slotId);
    });
    close.addEventListener('click', () => dismiss(host, aside, c, slotId));
    // Our own promos are tappable all over; the button stays the real link for keyboards and screen readers.
    if (aside.dataset.whole === '1') aside.addEventListener('click', (event) => { if (!event.target.closest('.fcmt-ad-x, .fcmt-ad-cta')) cta.click(); });
  }

  function handlePush(c, cta, actions, slotId) {
    const push = window.FCPush;
    const topic = c.action.topic;
    const openPanel = () => window.dispatchEvent(new CustomEvent('fcmt:push-open'));
    if (!push) return openPanel();
    cta.disabled = true;
    const original = cta.textContent;
    cta.textContent = t.busy;
    const state = push.state?.();
    const blocked = ['denied', 'ios-install', 'unsupported'].includes(state);
    if (blocked) { cta.disabled = false; cta.textContent = original; return openPanel(); }
    Promise.resolve(push.setTopic(topic, true, 'house_ad')).then((result) => {
      const ok = result === undefined || result === true || result?.ok === true || push.state?.() === 'enabled';
      if (ok && push.state?.() === 'enabled') {
        events.add(c.id, slotId, 'conv', true);
        const note = el('span', 'fcmt-ad-note'); note.textContent = t.done;
        actions.replaceChildren(note);
      } else {
        cta.disabled = false; cta.textContent = original; openPanel();
      }
    }).catch(() => { cta.disabled = false; cta.textContent = original; openPanel(); });
  }

  function dismiss(host, aside, c, slotId) {
    events.add(c.id, slotId, 'dismiss', true);
    markDismissed(c.id);
    const days = settings.dismissDays;
    const note = el('div', 'fcmt-ad-gone');
    const text = el('span'); text.textContent = hasAdvertisingConsent() ? t.hidden.replace('{n}', String(days)) : t.hiddenSession;
    const undo = el('button', 'fcmt-ad-undo'); undo.type = 'button'; undo.textContent = t.undo;
    note.append(text, undo);
    host.replaceChildren(note);
    const timer = window.setTimeout(() => {
      host.remove();
      if (slotId === 'tool-sidebar') {
        const placeholder = document.querySelector('[data-ad-anchor="tool-sidebar"] [data-ad-placeholder]');
        if (placeholder) placeholder.hidden = false;
      }
    }, 6000);
    undo.addEventListener('click', () => {
      window.clearTimeout(timer);
      unmarkDismissed(c.id);
      host.replaceChildren(aside);
    });

  }

  function watchView(node, c, slotId) {
    let timer = 0;
    const viewObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!timer) {
            timer = window.setTimeout(() => {
              viewObserver.disconnect();
              events.add(c.id, slotId, 'view');
              countView(c.id);
            }, 1000);
          }
        } else if (timer) { window.clearTimeout(timer); timer = 0; }
      }
    }, { threshold: [0, 0.5, 1] });
    viewObserver.observe(node);
  }

  /* ------------------------------ debug ------------------------------ */

  function explain(slotId, creatives, ctx, state) {
    const rows = creatives.map((c) => ({ ad: c.headline.slice(0, 40), kind: c.kind, blocked: blockers(c, ctx, state, settings).join(' | ') || 'eligible' }));
    console.groupCollapsed('[ads] ' + slotId); console.table(rows); console.groupEnd();
  }

  window.FCMT_ADS = {
    debug: (on = true) => { safeSet(localStorage, 'fcmt:ads:debug', on ? '1' : '0'); location.reload(); },
    setAdFree: (on = true) => { window.FCMT_ADFREE = Boolean(on); },
    resetMe: () => { for (const k of Object.values(KEYS)) { safeRemove(localStorage, k); safeRemove(sessionStorage, k); } safeRemove(sessionStorage, 'fcmt:ads:calm:v1'); safeRemove(sessionStorage, 'fcmt:ads:dismissals'); location.reload(); }
  };
}

/* ====================================================================== */
/* Placement                                                              */
/* ====================================================================== */

function findAnchor(slotId, settings) {
  const content = document.getElementById('content');
  if (!content) return null;
  if (slotId === 'page-end') return { anchor: content, context: 'section' };
  const marked = document.querySelector('[data-ad-anchor="' + slotId + '"]');
  if (marked) return { anchor: marked, context: 'section' };

  if (slotId === 'tool-result') {
    const tool = content.querySelector('main, [data-tool-root]');
    if (!tool) return null;
    const results = [...tool.querySelectorAll('[data-ad-results], [data-results], #results, #result, .results, .result-panel')]
      .find((node) => !node.hidden && node.offsetHeight > 0);
    return { anchor: results || tool, context: 'section' };
  }

  if (slotId === 'page-mid') {
    const sections = [...content.querySelectorAll('section')].filter((section) => !section.parentElement.closest('section') && section.offsetHeight > 120);
    if (sections.length < 3) return null;
    const total = sections.reduce((sum, section) => sum + section.offsetHeight, 0);
    let run = 0;
    for (let i = 0; i < sections.length; i += 1) {
      run += sections[i].offsetHeight;
      if (i >= 1 && run >= total * 0.45) return { anchor: sections[i], context: 'section' };
    }
    return null;
  }

  if (slotId === 'article-early' || slotId === 'article-mid' || slotId === 'article-end') {
    const prose = document.querySelector('#blProse, .bl-prose, [data-ad-prose]');
    if (!prose) return null;
    if (slotId === 'article-end') return { anchor: prose, context: 'section' };
    const paras = [...prose.querySelectorAll(':scope > p')].filter((p) => p.textContent.trim().length > 60);
    if (slotId === 'article-early') {
      // Only add the fourth placement to long reads, and keep enough paragraphs between in-read ads.
      if (paras.length < 12 || (countWords(prose) < 1500 && paras.length < 18)) return null;
      const earlyIndex = Math.max(3, Math.round(paras.length * 0.25));
      return { anchor: paras[Math.min(earlyIndex, paras.length - 2) - 1], context: 'inline' };
    }
    if (paras.length < settings.minParagraphsForMid) return null;
    const index = Math.max(3, Math.round(paras.length * 0.4));
    return { anchor: paras[Math.min(index, paras.length - 2) - 1], context: 'inline' };
  }

  if (slotId === 'list-mid') {
    const list = document.querySelector('[data-ad-list]');
    if (!list) return null;
    const items = [...list.children].filter((n) => n.nodeType === 1);
    if (items.length < 6) return null;
    return { anchor: items[3], context: 'list' };
  }

  if (slotId === 'home-mid') {
    const sections = [...content.querySelectorAll('section')].filter((s) => !s.parentElement.closest('section') && s.offsetHeight > 120);
    if (sections.length < 4) return null;
    const total = sections.reduce((sum, s) => sum + s.offsetHeight, 0);
    let run = 0;
    for (let i = 0; i < sections.length; i += 1) {
      run += sections[i].offsetHeight;
      if (i >= 1 && run >= total * 0.45) return { anchor: sections[i], context: 'section' };
    }
    return null;
  }
  return null;
}

/* ====================================================================== */
/* Ad network                                                             */
/* ====================================================================== */

let adsenseLoading = null;
function loadAdsense(publisherId) {
  if (adsenseLoading) return adsenseLoading;
  adsenseLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(publisherId);
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('AdSense blocked')), { once: true });
    document.head.append(script);
  });
  return adsenseLoading;
}

function renderNetwork(host, slot, settings, events, onEmpty) {
  const unitId = settings.slots[slot.id].unitId;
  const t = COPY[root.dataset.locale] || COPY.en;
  host.classList.add('fcmt-ad-net');
  const label = el('span', 'fcmt-ad-net-label'); label.textContent = t.network;
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = settings.adsense.publisherId;
  ins.dataset.adSlot = unitId;
  ins.dataset.adFormat = slot.adsense === 'fluid' ? 'fluid' : 'auto';
  if (slot.adsense === 'fluid') ins.dataset.adLayoutKey = '';
  ins.dataset.fullWidthResponsive = 'true';
  host.replaceChildren(label, ins);
  events.add('adsense', slot.id, 'nreq');
  let settled = false;
  const settle = (status) => {
    if (settled) return;
    settled = true;
    if (status === 'filled') events.add('adsense', slot.id, 'nfill');
    else { events.add('adsense', slot.id, 'nempty'); onEmpty(); }
  };
  new MutationObserver(() => {
    const status = ins.getAttribute('data-ad-status');
    if (status) settle(status);
  }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
  loadAdsense(settings.adsense.publisherId).then(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { settle('unfilled'); }
    window.setTimeout(() => { if (!settled && !ins.getAttribute('data-ad-status')) settle('unfilled'); }, 6000);
  }).catch(() => settle('unfilled'));
}

/* ====================================================================== */
/* Events                                                                 */
/* ====================================================================== */

function createEvents(pageType) {
  const queue = [];
  let timer = 0;
  const send = () => {
    window.clearTimeout(timer); timer = 0;
    if (!queue.length) return;
    const body = JSON.stringify({ e: queue.splice(0, 12) });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/ads/event', new Blob([body], { type: 'application/json' }))) return;
    } catch { /* fall through */ }
    fetch('/api/ads/event', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  window.addEventListener('pagehide', send);
  return {
    add(c, s, t, now = false) {
      queue.push({ c, s, p: pageType, t });
      if (now) send(); else if (!timer) timer = window.setTimeout(send, 2500);
    }
  };
}

/* ====================================================================== */
/* Visitor memory                                                         */
/* ====================================================================== */
// What a visitor hid or clicked is their own choice, so that is always remembered.
// Counting how often they saw an ad is stored on the device only with advertising consent.

function readState() {
  const store = hasAdvertisingConsent() ? localStorage : sessionStorage;
  const persistent = parseJson(safeGet(store, KEYS.state), {});
  const today = new Date().toDateString();
  const counted = parseJson(safeGet(store, KEYS.views), {});
  return {
    clickedAt: persistent.clickedAt || {},
    dismissedAt: persistent.dismissedAt || {},
    views: counted.day === today ? (counted.views || {}) : {}
  };
}
function writePersistent(mutate) {
  const store = hasAdvertisingConsent() ? localStorage : sessionStorage;
  const state = parseJson(safeGet(store, KEYS.state), {});
  state.clickedAt = state.clickedAt || {}; state.dismissedAt = state.dismissedAt || {};
  mutate(state);
  const cutoff = Date.now() - 100 * DAY;
  for (const map of [state.clickedAt, state.dismissedAt]) for (const id of Object.keys(map)) if (map[id] < cutoff) delete map[id];
  safeSet(store, KEYS.state, JSON.stringify(state));
}
const markClicked = (id) => writePersistent((s) => { s.clickedAt[id] = Date.now(); });
const markDismissed = (id) => writePersistent((s) => { s.dismissedAt[id] = Date.now(); });
const unmarkDismissed = (id) => writePersistent((s) => { delete s.dismissedAt[id]; });
function countView(id) {
  const store = hasAdvertisingConsent() ? localStorage : sessionStorage;
  const today = new Date().toDateString();
  const data = parseJson(safeGet(store, KEYS.views), {});
  const next = data.day === today ? data : { day: today, views: {} };
  next.views[id] = (next.views[id] || 0) + 1;
  safeSet(store, KEYS.views, JSON.stringify(next));
}
function bumpPageViews() {
  const n = Number(safeGet(sessionStorage, KEYS.pv) || 0) + 1;
  safeSet(sessionStorage, KEYS.pv, String(n));
  return n;
}

/* ====================================================================== */
/* Helpers                                                                */
/* ====================================================================== */

async function loadConfig() {
  const cached = parseJson(safeGet(sessionStorage, KEYS.config), null);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.data;
  try {
    const response = await fetch('/api/ads/config', { credentials: 'omit' });
    if (!response.ok) return cached?.data || null;
    const data = await response.json();
    safeSet(sessionStorage, KEYS.config, JSON.stringify({ at: Date.now(), data }));
    return data;
  } catch { return cached?.data || null; }
}

function hasAdvertisingConsent() {
  const row = document.cookie.split(';').map((p) => p.trim()).find((p) => p.startsWith('fcmobiletools_consent='));
  if (!row) return false;
  try {
    const choice = JSON.parse(decodeURIComponent(row.slice('fcmobiletools_consent='.length)));
    return choice?.version === '2' && choice?.advertising === true;
  } catch { return false; }
}

function isSignedIn() {
  try {
    const data = JSON.parse(localStorage.getItem('fcmobiletools-auth-v1') || 'null');
    return Boolean(data?.access_token || data?.session?.access_token || data?.currentSession?.access_token);
  } catch { return false; }
}

function countWords(node) {
  if (!node) return 0;
  const text = node.innerText || node.textContent || '';
  return (text.trim().match(/\S+/g) || []).length;
}

function injectStyle() {
  if (document.getElementById('fcmt-ads-style')) return;
  const style = document.createElement('style');
  style.id = 'fcmt-ads-style';
  style.textContent = css;
  document.head.append(style);
}

function el(tag, className) { const node = document.createElement(tag); if (className) node.className = className; return node; }
function parseJson(text, fallback) { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } }
function safeGet(store, key) { try { return store.getItem(key); } catch { return null; } }
function safeSet(store, key, value) { try { store.setItem(key, value); } catch { /* storage can be blocked */ } }
function safeRemove(store, key) { try { store.removeItem(key); } catch { /* same */ } }
function log(on, ...args) { if (on) console.info('[ads]', ...args); }

// Start last, so every constant above exists before boot() reads it.
if (root) boot().catch(() => { /* an ad problem must never break a page */ });

export { AD_SLOTS };
