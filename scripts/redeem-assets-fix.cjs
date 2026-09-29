const fs = require('node:fs');

const path = 'src/pages/redeem-codes.astro';
let text = fs.readFileSync(path, 'utf8');

function replaceOrFail(pattern, replacement, label, flags = '') {
  const next = text.replace(new RegExp(pattern, flags), replacement);
  if (next === text) throw new Error(`Patch failed: ${label}`);
  text = next;
}

replaceOrFail(
  "const heroBanner = '[^']*';\\nconst heroVisual = '[^']*';\\nconst heroRewardVisual = '[^']*';",
  "const heroObject = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_1000/v1789655014/fc-mobile-tools/clmgprc6viqdrp4zhdfj.png';\\nconst heroSupport = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_900/v1789653531/fc-mobile-tools/o6ocwktktmw5yml9n8km.png';\\nconst heroStrip = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_1400/v1789654488/fc-mobile-tools/wsaga0c3xdaqq3yggrme.png';",
  'hero assets',
);

replaceOrFail(
  "const pageSchema = \\{[\\s\\S]*?\\n\\};\\n\\nconst breadcrumbSchema =",
  `const pageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'FC Mobile Redeem Codes | Working Codes, Rewards & EA Redemption | FCMOBILETOOLS',
  description: 'Find working FC Mobile redeem codes, active codes, rewards and official EA redemption steps on FCMOBILETOOLS.',
  url: new URL(Astro.url.pathname, Astro.site ?? 'https://fcmobiletools.online').href,
  dateModified: lastUpdated || undefined,
  primaryImageOfPage: {
    '@type': 'ImageObject',
    contentUrl: heroObject,
    caption: 'FC Mobile redeem codes and rewards on FCMOBILETOOLS',
  },
  publisher: {
    '@type': 'Organization',
    name: 'FCMOBILETOOLS',
  },
  about: [
    { '@type': 'Thing', name: 'FC Mobile redeem codes' },
    { '@type': 'Thing', name: 'EA FC Mobile codes' },
    { '@type': 'Thing', name: 'FC Mobile rewards' },
  ],
  mainEntity: {
    '@type': 'ItemList',
    name: 'Working FC Mobile redeem codes',
    numberOfItems: activeCodes.length,
    itemListElement: activeCodes.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.code,
      description: item.reward,
    })),
  },
};

const breadcrumbSchema =`,
  'page schema',
);

replaceOrFail(
  "const breadcrumbSchema = \\{[\\s\\S]*?\\n\\};\\n---",
  `const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'FCMOBILETOOLS', item: new URL('/', Astro.site ?? 'https://fcmobiletools.online').href },
    { '@type': 'ListItem', position: 2, name: 'FC Mobile Redeem Codes', item: new URL('/redeem-codes', Astro.site ?? 'https://fcmobiletools.online').href },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What are FC Mobile redeem codes?',
      acceptedAnswer: { '@type': 'Answer', text: 'FC Mobile redeem codes are promotional codes redeemed through EA\\'s official FC Mobile redemption website for in-game rewards such as Gems, Coins, Player Items or Packs.' },
    },
    {
      '@type': 'Question',
      name: 'How do I redeem an FC Mobile code?',
      acceptedAnswer: { '@type': 'Answer', text: 'Open the official EA FC Mobile redemption page, sign in with the EA Account linked to your FC Mobile game, enter the valid code and select Redeem. Successful rewards are delivered to the in-game inbox.' },
    },
    {
      '@type': 'Question',
      name: 'Why is my FC Mobile redeem code not working?',
      acceptedAnswer: { '@type': 'Answer', text: 'Check that the code is entered exactly, has not expired or reached its usage limit, and that the EA Account you use is the same account linked to your FC Mobile game.' },
    },
  ],
};
---`,
  'breadcrumb and FAQ schema',
);

replaceOrFail(
  '  title="[^"]*FC Mobile Redeem Codes[^"]*"',
  '  title="FC Mobile Redeem Codes | Working Codes, Rewards & EA Redemption | FCMOBILETOOLS"',
  'page title',
);
replaceOrFail(
  '  description="[^"]*"',
  '  description="Find working FC Mobile redeem codes, active codes, rewards and official EA redemption steps on FCMOBILETOOLS. Check status, copy codes and redeem through EA."',
  'page description',
);
replaceOrFail('  image=\\{heroBanner\\}', '  image={heroObject}', 'social image');
replaceOrFail('TANZIMFC / FC MOBILE TOOLS', 'FCMOBILETOOLS / FC MOBILE TOOLS', 'hero brand');

const newHeader = `      <header class="hero">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="eyebrow-line"></span>
            FCMOBILETOOLS / FC MOBILE TOOLS
            <b class="live-status"><i></i> LIVE CODE DATABASE</b>
          </div>

          <h1>FC Mobile <em>Redeem Codes</em></h1>

          <p class="hero-lede">
            Find working FC Mobile redeem codes, check active status, copy a code in one tap,
            and continue straight to the official EA redemption page.
          </p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="#live">View active codes <span>↓</span></a>
            <a class="btn btn-ghost" href="https://redeem.fcm.ea.com/" target="_blank" rel="noopener noreferrer">
              Open EA redemption <span>↗</span>
            </a>
          </div>

          <div class="hero-trust" aria-label="FCMOBILETOOLS redeem code features">
            <span><i></i> Active + archived tracking</span>
            <span><i></i> Copy ready</span>
            <span><i></i> Official EA destination</span>
          </div>
        </div>

        <div class="hero-showcase" aria-label="FC Mobile redeem code artwork">
          <div class="hero-stage">
            <div class="hero-stage-glow"></div>
            <div class="hero-ring hero-ring-one"></div>
            <div class="hero-ring hero-ring-two"></div>

            <div class="hero-object-main">
              <img
                src={heroObject}
                alt="FC Mobile redeem codes artwork"
                width="1000"
                height="1000"
                fetchpriority="high"
                decoding="async"
              />
            </div>

            <div class="hero-object-secondary">
              <img
                src={heroSupport}
                alt="FC Mobile rewards artwork"
                width="900"
                height="900"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div class="hero-strip-card">
              <img src={heroStrip} alt="" width="1400" height="900" loading="lazy" decoding="async" aria-hidden="true" />
              <div class="hero-strip-overlay">
                <span>FC MOBILE CODES</span>
                <b><i></i> LIVE</b>
              </div>
            </div>
          </div>
        </div>
      </header>

`;
replaceOrFail('      <header class="hero">[\\s\\S]*?      </header>\\n\\n', newHeader, 'hero markup');

const seoSection = `<section class="seo-expanded" aria-labelledby="redeem-guide-heading">
  <span class="section-kicker">FC MOBILE REDEEM CODE GUIDE</span>
  <h2 id="redeem-guide-heading">FC Mobile redeem codes, rewards and redemption guide</h2>
  <p>FCMOBILETOOLS keeps FC Mobile redeem codes in one searchable place with active, scheduled and expired records, reward details, release dates and verification dates. Use the working-code section for current entries, then continue to EA's official redemption page.</p>
  <p>FC Mobile redeem codes can unlock rewards such as Coins, Gems, Player Items and Packs when an official promotion is available. Codes can expire or have usage limits, so check the status shown here before redeeming.</p>
  <p>When a code fails, copy it exactly, confirm it has not expired, and use the same EA Account linked to your FC Mobile game. Successful redemptions are delivered through the in-game inbox.</p>
</section>

<section class="faq-section" aria-labelledby="redeem-faq-heading">
  <span class="section-kicker">FC MOBILE REDEEM CODE FAQ</span>
  <h2 id="redeem-faq-heading">Common FC Mobile code questions</h2>
  <div class="faq-list">
    <details open><summary>What are FC Mobile redeem codes?</summary><p>They are promotional codes redeemed through EA's official FC Mobile redemption website for rewards such as Gems, Coins, Player Items or Packs.</p></details>
    <details><summary>How do I redeem an FC Mobile code?</summary><p>Open the official EA redemption page, sign in with the EA Account linked to your FC Mobile game, enter the code and select Redeem. Successful rewards arrive in your in-game inbox.</p></details>
    <details><summary>Why is my FC Mobile code not working?</summary><p>Check the code exactly, confirm it has not expired or reached its usage limit, and make sure you are using the same EA Account linked to FC Mobile.</p></details>
  </div>
</section>`;
replaceOrFail('<section class="seo-expanded" aria-labelledby="redeem-guide-heading">[\\s\\S]*?</section>', seoSection, 'SEO guide', '');

const globalStyle = `  <style is:global>
.codes-page .hero{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);align-items:center;min-height:clamp(600px,72vh,760px);margin-bottom:10px;padding:clamp(28px,4.2vw,58px) clamp(20px,4.4vw,58px);overflow:hidden;border:1px solid #1f4053;border-radius:30px;background:radial-gradient(circle at 78% 40%,#1cb8ef0b,transparent 26%),linear-gradient(145deg,#09131b,#071018 55%,#08131d);box-shadow:0 34px 90px #0009,inset 0 0 0 1px #56d6ff0c}
.codes-page .hero:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#071018a8,transparent 48%,#56d6ff05 100%)}
.codes-page .hero-copy{position:relative;z-index:4;min-width:0;max-width:700px;display:flex;flex-direction:column;justify-content:center}
.codes-page .hero-copy h1{max-width:700px;margin:20px 0 18px;font-size:clamp(46px,6.2vw,84px);line-height:.95;letter-spacing:-.067em;text-shadow:0 8px 40px #0009}
.codes-page .hero-copy .hero-lede{max-width:620px;color:#c4d6df}
.codes-page .eyebrow{gap:10px}.codes-page .eyebrow-line{width:28px;height:1px;background:linear-gradient(90deg,var(--cyan),transparent)}
.codes-page .live-status{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #ff4d4d35;border-radius:999px;background:#ff3d3d08;color:#ff8d8d;font-size:7px;letter-spacing:.11em}
.codes-page .live-status i,.codes-page .hero-strip-overlay b i{width:6px;height:6px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 0 0 #ff4d4d55;animation:live-beat 1.5s ease-in-out infinite}
.codes-page .hero-trust{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}.codes-page .hero-trust span{display:inline-flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid #20343f;border-radius:999px;background:#09141b99;color:#86a0ad;font:600 8px var(--mono)}.codes-page .hero-trust i{width:5px;height:5px;border-radius:50%;background:var(--cyan);box-shadow:0 0 0 4px #56d6ff0b}
.codes-page .hero-showcase{position:relative;z-index:3;min-width:0;min-height:500px;display:grid;place-items:center}.codes-page .hero-stage{position:relative;width:min(100%,620px);aspect-ratio:1.08/1;margin-inline:auto}.codes-page .hero-stage-glow{position:absolute;inset:16% 13% 14%;border-radius:50%;background:radial-gradient(circle,#56d6ff18 0%,#56d6ff08 38%,transparent 72%);filter:blur(14px);animation:glow-breathe 5s ease-in-out infinite}.codes-page .hero-ring{position:absolute;border-radius:50%;border:1px solid #56d6ff14;pointer-events:none}.codes-page .hero-ring-one{inset:10% 8%;transform:rotate(14deg);animation:slow-spin 28s linear infinite}.codes-page .hero-ring-two{inset:20% 17%;border-color:#5c7eff12;transform:rotate(-14deg);animation:slow-spin-reverse 34s linear infinite}
.codes-page .hero-object-main{position:absolute;left:50%;top:48%;width:min(72%,500px);transform:translate3d(-48%,-50%,0);filter:drop-shadow(0 34px 44px #000b);transition:transform .18s ease-out}.codes-page .hero-showcase:hover .hero-object-main{transform:translate3d(-48%,-52%,0) rotate(-1deg) scale(1.012)}.codes-page .hero-object-main img,.codes-page .hero-object-secondary img{display:block;width:100%;height:auto;object-fit:contain}.codes-page .hero-object-secondary{position:absolute;right:1%;top:12%;width:clamp(120px,23%,190px);transform:rotate(5deg);filter:drop-shadow(0 22px 34px #000a);animation:hero-float 6s ease-in-out infinite}
.codes-page .hero-strip-card{position:absolute;left:4%;bottom:2%;width:min(76%,410px);aspect-ratio:2.35/1;overflow:hidden;border:1px solid #2b5268;border-radius:16px;background:#09131a;box-shadow:0 18px 45px #0008;transform:rotate(-2deg);transition:transform .2s ease,border-color .2s ease}.codes-page .hero-strip-card:hover{transform:translateY(-5px) rotate(-1deg);border-color:#4f89a5}.codes-page .hero-strip-card img{width:100%;height:100%;display:block;object-fit:cover;object-position:center;filter:saturate(.9) contrast(1.06);opacity:.8}.codes-page .hero-strip-card:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#061018e8 0%,#061018a0 45%,#06101810 100%)}.codes-page .hero-strip-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 13px;z-index:2;color:#cbe8f2;font:700 8px var(--mono);letter-spacing:.12em}.codes-page .hero-strip-overlay b{display:inline-flex;align-items:center;gap:6px;color:#ff9292}
.codes-page .seo-expanded,.codes-page .faq-section{margin-top:22px;padding:34px;border:1px solid #1d3343;border-radius:22px;background:linear-gradient(145deg,#0b151f,#071018)}.codes-page .seo-expanded h2,.codes-page .faq-section h2{margin-bottom:14px}.codes-page .seo-expanded p{max-width:900px;color:#a9bac8;line-height:1.85}.codes-page .faq-list{display:grid;gap:9px;margin-top:18px}.codes-page .faq-list details{border:1px solid #1b303c;border-radius:14px;background:#09131a;overflow:hidden}.codes-page .faq-list summary{cursor:pointer;list-style:none;padding:15px 16px;color:#dff2f8;font:700 10px var(--sans)}.codes-page .faq-list summary::-webkit-details-marker{display:none}.codes-page .faq-list summary:after{content:"+";float:right;color:var(--cyan);font:700 16px var(--mono);line-height:1}.codes-page .faq-list details[open] summary:after{content:"−"}.codes-page .faq-list p{margin:0;padding:0 16px 16px;color:#91a8b4;font-size:10px;line-height:1.75}
@keyframes live-beat{0%,100%{opacity:1;box-shadow:0 0 0 0 #ff4d4d55}50%{opacity:.65;box-shadow:0 0 0 7px #ff4d4d00}}@keyframes glow-breathe{0%,100%{opacity:.8;transform:scale(.98)}50%{opacity:1;transform:scale(1.03)}}@keyframes hero-float{0%,100%{transform:translateY(0) rotate(5deg)}50%{transform:translateY(-8px) rotate(3.5deg)}}@keyframes slow-spin{to{transform:rotate(374deg)}}@keyframes slow-spin-reverse{to{transform:rotate(-374deg)}}
@media(max-width:1100px){.codes-page .hero{grid-template-columns:1fr;min-height:760px}.codes-page .hero-copy{max-width:820px}.codes-page .hero-showcase{min-height:410px}.codes-page .hero-stage{width:min(92vw,560px)}}
@media(max-width:700px){.codes-page .hero{min-height:auto;padding:34px 20px 24px;border-radius:22px}.codes-page .hero-copy h1{font-size:clamp(42px,12vw,64px)}.codes-page .hero-actions{flex-direction:column}.codes-page .hero-actions .btn{width:100%}.codes-page .hero-trust{display:grid}.codes-page .hero-trust span{width:fit-content}.codes-page .hero-showcase{min-height:370px;margin-top:12px}.codes-page .hero-stage{width:100%;aspect-ratio:1/1}.codes-page .hero-object-main{width:min(78vw,360px);top:47%}.codes-page .hero-object-secondary{width:clamp(104px,29vw,145px);right:0;top:9%}.codes-page .hero-strip-card{left:1%;bottom:1%;width:min(82%,330px)}.codes-page .hero-strip-overlay{padding-inline:10px;font-size:7px}.codes-page .seo-expanded,.codes-page .faq-section{padding:22px;border-radius:18px}}@media(max-width:430px){.codes-page .hero-copy{padding-inline:0}.codes-page .hero-showcase{min-height:340px}.codes-page .hero-object-main{width:82vw}.codes-page .hero-object-secondary{right:-2%;width:118px}.codes-page .hero-strip-card{width:76%;bottom:0}}@media(prefers-reduced-motion:reduce){.codes-page .live-status i,.codes-page .hero-stage-glow,.codes-page .hero-object-secondary,.codes-page .hero-ring-one,.codes-page .hero-ring-two{animation:none}.codes-page .hero-object-main,.codes-page .hero-strip-card{transition:none}}
</style>

<script define:vars=`;
replaceOrFail('  <style is:global>[\\s\\S]*?</style>\\n\\n<script define:vars=', globalStyle + '\n<script define:vars=', 'global style', '');

const newScript = `<script define:vars={{ pageSchema, breadcrumbSchema, faqSchema }}>
    const toast = document.getElementById('toast');
    const notify = (message) => {
      toast.textContent = message;
      toast.classList.add('show');
      window.clearTimeout(window.__redeemToast);
      window.__redeemToast = window.setTimeout(() => toast.classList.remove('show'), 1900);
    };
    const copyCode = async (code, button) => {
      try {
        await navigator.clipboard.writeText(code);
        if (button) {
          const original = button.innerHTML;
          button.innerHTML = 'Copied <span>✓</span>';
          window.setTimeout(() => { button.innerHTML = original; }, 1500);
        }
        notify(code + ' copied to clipboard');
      } catch {
        notify('Clipboard access is unavailable');
      }
    };
    document.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', () => copyCode(button.dataset.copy, button));
    });
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify(pageSchema);
    document.head.appendChild(ld);
    const crumbs = document.createElement('script');
    crumbs.type = 'application/ld+json';
    crumbs.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(crumbs);
    const faqLd = document.createElement('script');
    faqLd.type = 'application/ld+json';
    faqLd.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(faqLd);
  </script>`;
replaceOrFail('<script define:vars=\\{\\{ pageSchema, breadcrumbSchema \\}\\}>[\\s\\S]*?</script>', newScript, 'page script', '');

fs.writeFileSync(path, text);
console.log('Final FCMOBILETOOLS redeem polish applied');
