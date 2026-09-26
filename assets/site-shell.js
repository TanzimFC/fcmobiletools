(() => {
  if (document.querySelector('[data-site-nav]')) return;

  const nav = `<header class="site-nav" data-site-nav>
  <div class="site-nav-inner">
    <a class="site-logo" href="/" aria-label="FCMOBILETOOLS home"><img src="/assets/images/logo.png" alt="FCMOBILETOOLS"></a>
    <nav class="site-primary" aria-label="Primary navigation">
      <a class="site-link" href="/">Home</a>
      <div class="site-group"><button class="site-dropdown-trigger" type="button" aria-expanded="false" aria-haspopup="true">Tools <span aria-hidden="true">⌄</span></button><div class="site-dropdown"><a href="/team-ovr"><span><strong>Team OVR</strong><small>Squad rating</small></span><b>↗</b></a><a href="/training-calculator"><span><strong>Training Calculator</strong><small>XP &amp; fodder</small></span><b>↗</b></a><a href="/rank-up-calculator"><span><strong>Rank Up Calculator</strong><small>Rank costs</small></span><b>↗</b></a><a href="/investment-calculator"><span><strong>Investment Calculator</strong><small>Market planning</small></span><b>↗</b></a></div></div>
      <div class="site-group"><button class="site-dropdown-trigger" type="button" aria-expanded="false" aria-haspopup="true">Live <span aria-hidden="true">⌄</span></button><div class="site-dropdown"><a href="/events"><span><strong>Events &amp; Reset</strong><small>Countdowns &amp; schedules</small></span><b>↗</b></a><a href="/redeem-codes"><span><strong>Redeem Codes</strong><small>Current rewards</small></span><b>↗</b></a><a href="/football-centre"><span><strong>Football Centre</strong><small>Matches &amp; points</small></span><b>↗</b></a><a href="/a-nations-story"><span><strong>A Nation's Story</strong><small>Event answers</small></span><b>↗</b></a><a href="/fc-mobile-27"><span><strong>FC Mobile 27 APK</strong><small>Latest Android release</small></span><b>↗</b></a></div></div>
      <a class="site-link" href="/blog/">Articles</a><a class="site-link" href="/creator">Creator</a><a class="site-cta" href="/redeem-codes"><i></i><span>Redeem Codes</span></a>
    </nav>
    <button class="site-menu" type="button" aria-expanded="false" aria-controls="site-mobile-nav" aria-label="Open menu"><span class="site-menu-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
  </div>
  <nav id="site-mobile-nav" class="site-mobile-nav" aria-label="Mobile navigation">
    <a href="/">Home</a><div class="site-mobile-group"><strong>TOOLS</strong><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a><a href="/investment-calculator">Investment Calculator</a></div>
    <div class="site-mobile-group"><strong>LIVE</strong><a href="/events">Events &amp; Reset</a><a href="/redeem-codes">Redeem Codes</a><a href="/football-centre">Football Centre</a><a href="/a-nations-story">A Nation's Story</a><a href="/fc-mobile-27">FC Mobile 27 APK</a></div>
    <a href="/blog/">Articles</a><a href="/creator">Creator</a><a class="mobile-code" href="/redeem-codes"><i></i><span>Redeem Codes</span></a>
  </nav>
</header>`;

  const footer = `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-brand"><a class="site-brand" href="/"><span>FC</span> TanzimFC</a><p>Trackers, tools, trivia and guides for FC Mobile, built and maintained by TanzimFC.</p></div>
    <div class="footer-cols">
      <div class="footer-col"><b>TOOLS</b><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a><a href="/redeem-codes">Redeem Codes</a></div>
      <div class="footer-col"><b>EXPLORE</b><a href="/football-centre">Football Centre</a><a href="/trivia/">Trivia</a><a href="/blog/">Blog &amp; Guides</a><a href="/creator">Creator</a></div>
      <div class="footer-col"><b>LEGAL</b><a href="/legal/privacy-policy">Privacy Policy</a><a href="/legal/terms-of-use">Terms of Use</a><a href="/legal/disclaimer">Disclaimer</a><a href="/legal/cookie-policy">Cookie Policy</a><a href="/legal/copyright">Copyright &amp; IP</a><a href="/legal/contact">Contact</a></div>
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
  header?.querySelectorAll('.site-group').forEach(group => {
    const trigger = group.querySelector('.site-dropdown-trigger');
    trigger?.addEventListener('click', () => {
      const open = group.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
      header.querySelectorAll('.site-group.open').forEach(other => { if (other !== group) other.classList.remove('open'); });
    });
  });
  button?.addEventListener('click', () => { const open = mobile?.classList.toggle('open') ?? false; button.setAttribute('aria-expanded', String(open)); });
  addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
})();
