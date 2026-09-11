(() => {
  if (document.querySelector('[data-site-nav]')) return;

  const nav = `
<header class="site-nav" data-site-nav>
  <div class="site-nav-inner">
    <a class="site-brand" href="/" aria-label="TanzimFC home"><span>FC</span> TanzimFC</a>
    <nav class="site-primary" aria-label="Primary navigation">
      <a href="/">Home</a>
      <div class="site-nav-group"><button type="button" class="site-nav-trigger">Tools <span>⌄</span></button><div class="site-nav-menu"><a href="/team-ovr"><span>Team OVR</span><small>↗</small></a><a href="/training-calculator"><span>Training Calculator</span><small>↗</small></a><a href="/rank-up-calculator"><span>Rank Up Calculator</span><small>↗</small></a></div></div>
      <div class="site-nav-group"><button type="button" class="site-nav-trigger">Explore <span>⌄</span></button><div class="site-nav-menu"><a href="/football-centre"><span>Football Centre</span><small>↗</small></a><a href="/trivia/"><span>Trivia</span><small>↗</small></a><a href="/blog/"><span>Blog</span><small>↗</small></a><a href="/creator"><span>Creator</span><small>↗</small></a></div></div>
      <a href="/redeem-codes">Redeem Codes</a>
    </nav>
    <button class="site-menu" type="button" aria-expanded="false" aria-controls="site-mobile-nav" aria-label="Open menu">☰</button>
  </div>
  <nav id="site-mobile-nav" class="site-mobile-nav" aria-label="Mobile navigation">
    <a href="/">Home</a>
    <div class="site-mobile-group"><span>Tools</span><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a></div>
    <div class="site-mobile-group"><span>Explore</span><a href="/football-centre">Football Centre</a><a href="/trivia/">Trivia</a><a href="/blog/">Blog</a><a href="/creator">Creator</a></div>
    <a href="/redeem-codes">Redeem Codes</a>
  </nav>
</header>`;

  const footer = `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-brand"><a class="site-brand" href="/"><span>FC</span> TanzimFC</a><p>Trackers, tools, trivia and guides for FC Mobile, built and maintained by TanzimFC.</p></div>
    <div class="footer-cols">
      <div class="footer-col"><b>TOOLS</b><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a><a href="/redeem-codes">Redeem Codes</a></div>
      <div class="footer-col"><b>EXPLORE</b><a href="/football-centre">Football Centre</a><a href="/trivia/">Trivia</a><a href="/blog/">Blog &amp; Guides</a><a href="/creator">Creator</a></div>
      <div class="footer-col"><b>LEGAL</b><a href="/legal/privacy-policy">Privacy Policy</a><a href="/legal/terms-of-use">Terms of Use</a><a href="/legal/disclaimer">Disclaimer</a><a href="/legal/contact">Contact</a></div>
      <div class="footer-col"><b>CONNECT</b><a href="https://www.youtube.com/@tanzimfc" target="_blank" rel="noopener">YouTube</a><a href="https://discord.com/invite/B4a7AxuU69" target="_blank" rel="noopener">Discord</a><a href="https://x.com/TanzimFC" target="_blank" rel="noopener">X / Twitter</a></div>
    </div>
  </div>
  <div class="footer-bottom"><span>© ${new Date().getFullYear()} TanzimFC — FC Mobile Tools</span><span>Not affiliated with EA or FC Mobile</span></div>
</footer>`;

  document.querySelectorAll('header.topbar, header.site-header').forEach(el => el.remove());
  document.querySelectorAll('footer.site-footer').forEach(el => { if (!el.closest('[data-site-nav]')) el.remove(); });
  const navMount = document.querySelector('[data-site-nav-placeholder]');
  if (navMount) navMount.outerHTML = nav; else document.body.insertAdjacentHTML('afterbegin', nav);
  const footerMount = document.querySelector('[data-site-footer-placeholder]');
  if (footerMount) footerMount.outerHTML = footer; else document.body.insertAdjacentHTML('beforeend', footer);

  const header = document.querySelector('[data-site-nav]');
  const button = header?.querySelector('.site-menu');
  const mobile = header?.querySelector('.site-mobile-nav');
  const path = location.pathname.replace(/\/$/, '') || '/';
  header?.querySelectorAll('a').forEach(a => {
    const url = new URL(a.href, location.origin);
    const target = url.pathname.replace(/\/$/, '') || '/';
    if (target === path && !url.hash) a.classList.add('active');
  });
  header?.querySelectorAll('.site-nav-group').forEach(group => {
    const trigger = group.querySelector('.site-nav-trigger');
    trigger?.addEventListener('click', () => {
      const open = group.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
      header.querySelectorAll('.site-nav-group.open').forEach(other => { if (other !== group) other.classList.remove('open'); });
    });
  });
  button?.addEventListener('click', () => { const open = mobile?.classList.toggle('open') ?? false; button.setAttribute('aria-expanded', String(open)); });
  addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
})();
