(() => {
  const nav = `
<header class="site-nav" data-site-nav>
  <div class="site-nav__inner">
    <a class="site-brand" href="/" aria-label="FC Mobile Tools home">
      <span class="site-brand__mark">FC</span>
      <span class="site-brand__text"><small>FC MOBILE TOOLS</small><strong>TanzimFC</strong></span>
    </a>
    <nav class="site-nav__links" aria-label="Primary navigation">
      <a href="/">Home</a>
      <a href="/football-centre">Football Centre</a>
      <a href="/trivia/">Trivia</a>
      <a href="/blog/">Blog</a>
      <a href="/fc-mobile-beta">Beta</a>
      <a href="/#creator">Creator</a>
    </nav>
    <a class="site-nav__cta" href="/football-centre">Open Football Centre <span>→</span></a>
    <button class="site-nav__toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-mobile-nav"><span></span><span></span><span></span></button>
  </div>
  <div class="site-mobile-nav" id="site-mobile-nav" hidden>
    <a href="/">Home</a><a href="/football-centre">Football Centre</a><a href="/trivia/">Trivia</a><a href="/blog/">Blog</a><a href="/fc-mobile-beta">Beta</a><a href="/#creator">Creator</a>
  </div>
</header>`;

  const footer = `
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <a class="site-brand" href="/"><span class="site-brand__mark">FC</span><span class="site-brand__text"><small>FC MOBILE TOOLS</small><strong>TanzimFC</strong></span></a>
      <p>Trackers, tools, guides and event resources for FC Mobile players.</p>
    </div>
    <div class="site-footer__links">
      <div><b>TOOLS</b><a href="/football-centre">Football Centre</a><a href="/trivia/">Trivia</a><a href="/fc-mobile-beta">FC Mobile Beta</a><a href="/blog/">Blog &amp; Guides</a></div>
      <div><b>LEGAL</b><a href="/legal/privacy-policy">Privacy Policy</a><a href="/legal/terms-of-use">Terms of Use</a><a href="/legal/disclaimer">Disclaimer</a><a href="/legal/contact">Contact</a></div>
      <div><b>CONNECT</b><a href="https://www.youtube.com/@tanzimfc" target="_blank" rel="noopener">YouTube</a><a href="https://discord.com/invite/B4a7AxuU69" target="_blank" rel="noopener">Discord</a><a href="https://x.com/TanzimFC" target="_blank" rel="noopener">X / Twitter</a></div>
    </div>
  </div>
  <div class="site-footer__bottom"><span>© ${new Date().getFullYear()} TanzimFC — FC Mobile Tools</span><span>Not affiliated with EA or FC Mobile</span></div>
</footer>`;

  const mount = (selector, html) => { const el = document.querySelector(selector); if (el) el.outerHTML = html; };
  mount('[data-site-nav-placeholder]', nav);
  mount('[data-site-footer-placeholder]', footer);

  const header = document.querySelector('[data-site-nav]');
  const toggle = document.querySelector('.site-nav__toggle');
  const mobile = document.getElementById('site-mobile-nav');
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.site-nav__links a, .site-mobile-nav a').forEach(a => {
    const href = new URL(a.href, location.origin);
    const target = href.pathname.replace(/\/$/, '') || '/';
    if (target === path && !href.hash) a.setAttribute('aria-current', 'page');
  });
  addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    if (mobile) mobile.hidden = open;
  });
})();
