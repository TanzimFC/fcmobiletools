(() => {
  if (document.querySelector('[data-site-nav]')) return;

  const nav = `<header class="site-nav" data-site-nav>
  <div class="site-nav-inner">
    <a class="site-logo" href="/" aria-label="FCMOBILETOOLS home"><img src="/assets/images/logo.png" alt="FCMOBILETOOLS"></a>
    <nav class="site-primary" aria-label="Primary navigation">
      <a class="site-link" href="/">Home</a>
      <div class="site-group"><button class="site-dropdown-trigger" type="button" aria-expanded="false" aria-haspopup="true">Tools <span aria-hidden="true">⌄</span></button><div class="site-dropdown"><a href="/team-ovr"><span><strong>Team OVR</strong><small>Squad rating</small></span><b>↗</b></a><a href="/training-calculator"><span><strong>Training Calculator</strong><small>XP &amp; fodder</small></span><b>↗</b></a><a href="/rank-up-calculator"><span><strong>Rank Up Calculator</strong><small>Rank costs</small></span><b>↗</b></a><a href="/investment-calculator"><span><strong>Investment Calculator</strong><small>Market planning</small></span><b>↗</b></a></div></div>
      <div class="site-group"><button class="site-dropdown-trigger" type="button" aria-expanded="false" aria-haspopup="true">Live <span aria-hidden="true">⌄</span></button><div class="site-dropdown"><a href="/events"><span><strong>Events &amp; Reset</strong><small>Countdowns &amp; schedules</small></span><b>↗</b></a><a href="/redeem-codes"><span><strong>Redeem Codes</strong><small>Current rewards</small></span><b>↗</b></a><a href="/football-centre"><span><strong>Football Centre</strong><small>Matches &amp; points</small></span><b>↗</b></a><a href="/fcmtv/"><span><strong>FCM TV</strong><small>Gameplay &amp; tutorials</small></span><b>↗</b></a><a href="/a-nations-story"><span><strong>A Nation's Story</strong><small>Event answers</small></span><b>↗</b></a><a href="/fc-mobile-27"><span><strong>FC Mobile 27 Update</strong><small>Season 27 guide + install</small></span><b>↗</b></a></div></div>
      <a class="site-link" href="/blog/">Articles</a><a class="site-link" href="/creator">Creator</a><a class="site-cta" href="/account/"><i></i><span>Account</span></a>
    </nav>
    <button class="site-menu" type="button" aria-expanded="false" aria-controls="site-mobile-nav" aria-label="Open menu"><span class="site-menu-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
  </div>
  <nav id="site-mobile-nav" class="site-mobile-nav" aria-label="Mobile navigation">
    <a href="/">Home</a><div class="site-mobile-group"><strong>TOOLS</strong><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a><a href="/investment-calculator">Investment Calculator</a></div>
    <div class="site-mobile-group"><strong>LIVE</strong><a href="/events">Events &amp; Reset</a><a href="/redeem-codes">Redeem Codes</a><a href="/football-centre">Football Centre</a><a href="/a-nations-story">A Nation's Story</a><a href="/fc-mobile-27">FC Mobile 27 Update</a></div>
    <a href="/blog/">Articles</a><a href="/creator">Creator</a><a class="mobile-code" href="/account/"><i></i><span>Account</span></a>
  </nav>
</header>`;

  const footer = `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-brand"><a class="site-brand" href="/"><span>FC</span> TanzimFC</a><p>Trackers, tools, trivia and guides for FC Mobile, built and maintained by TanzimFC.</p></div>
    <div class="footer-cols">
      <div class="footer-col"><b>TOOLS</b><a href="/team-ovr">Team OVR</a><a href="/training-calculator">Training Calculator</a><a href="/rank-up-calculator">Rank Up Calculator</a><a href="/redeem-codes">Redeem Codes</a></div>
      <div class="footer-col"><b>EXPLORE</b><a href="/football-centre">Football Centre</a><a href="/fcmtv/">FCM TV</a><a href="/trivia/">Trivia</a><a href="/blog/">Blog &amp; Guides</a><a href="/creator">Creator</a></div>
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
  const closeMobile = () => {
    mobile?.classList.remove('open');
    button?.setAttribute('aria-expanded', 'false');
    button?.setAttribute('aria-label', 'Open menu');
  };
  button?.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = mobile?.classList.toggle('open') ?? false;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  mobile?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobile));
  document.addEventListener('click', event => {
    if (!header?.contains(event.target)) {
      header?.querySelectorAll('.site-group.open').forEach(group => group.classList.remove('open'));
      closeMobile();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    header?.querySelectorAll('.site-group.open').forEach(group => group.classList.remove('open'));
    closeMobile();
  });
  addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 8), { passive: true });

  const getAccountToken=()=>{
    try {
      const raw=localStorage.getItem('fcmobiletools-auth-v1');
      const data=raw?JSON.parse(raw):null;
      return data?.access_token || data?.session?.access_token || data?.currentSession?.access_token || '';
    } catch { return ''; }
  };
  const trackActivity=async(eventType,entityType,entityId,durationMs)=>{
    const token=getAccountToken();
    if(!token) return {ok:false};
    try{
      const response=await fetch('/api/account/activity',{
        method:'POST',
        headers:{authorization:'Bearer '+token,'content-type':'application/json'},
        body:JSON.stringify({eventType,entityType,entityId,durationMs,idempotencyKey:crypto.randomUUID()})
      });
      return await response.json().catch(()=>({ok:response.ok}));
    }catch{return {ok:false};}
  };
  window.addEventListener('fcmobiletools:tool-activity',event=>{
    const detail=event.detail;
    if(!detail?.entityId) return;
    trackActivity('calculator_use','calculator',String(detail.entityId),Math.max(3000,Math.min(600000,Number(detail.durationMs||3000))));
  });

  const accountCta=header?.querySelector('.site-cta[href="/account/"] span');
  if(accountCta && getAccountToken()) accountCta.textContent='Your Account';

  const route=path;
  if(route==='/events' || route==='/redeem-codes'){
    let visibleMs=0;
    let lastTick=performance.now();
    let done=false;
    const timer=window.setInterval(()=>{
      if(done){window.clearInterval(timer);return;}
      const now=performance.now();
      if(!document.hidden) visibleMs+=Math.max(0,now-lastTick);
      lastTick=now;
      if(visibleMs>=8000){
        done=true;
        window.clearInterval(timer);
        trackActivity('page_dwell','page',route,8000);
      }
    },250);
    document.addEventListener('visibilitychange',()=>{lastTick=performance.now();},{passive:true});
  }
  const calculatorRoutes={
    '/training-calculator':'training-calculator',
    '/investment-calculator':'investment-calculator'
  };
  if(calculatorRoutes[route]){
    let interactionSeen=false;
    let interactionTimer=0;
    const arm=()=>{
      if(interactionSeen) return;
      interactionSeen=true;
      window.clearTimeout(interactionTimer);
      interactionTimer=window.setTimeout(()=>trackActivity('calculator_use','calculator',calculatorRoutes[route],3000),3500);
    };
    const main=document.querySelector('main');
    main?.addEventListener('input',arm,{once:true,passive:true});
    main?.addEventListener('change',arm,{once:true,passive:true});
    main?.addEventListener('click',(event)=>{
      const target=event.target;
      if(target?.closest('a,[data-site-nav]')) return;
      arm();
    },{once:true});
  }
})();
