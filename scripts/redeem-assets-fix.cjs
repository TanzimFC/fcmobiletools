const fs = require('node:fs');

const path = 'src/pages/redeem-codes.astro';
let text = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    /const heroImage =\s*'[^']*';/,
    `const heroBanner = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_2000/v1789654488/fc-mobile-tools/wsaga0c3xdaqq3yggrme.png';\nconst heroVisual = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_1000/v1789653531/fc-mobile-tools/o6ocwktktmw5yml9n8km.png';\nconst heroRewardVisual = 'https://res.cloudinary.com/b0qikv7n/image/upload/f_auto,q_auto,w_700/v1789655014/fc-mobile-tools/clmgprc6viqdrp4zhdfj.png';`,
  ],
  [/contentUrl: heroImage,/g, 'contentUrl: heroBanner,'],
  [/  image=\{heroImage\}/g, '  image={heroBanner}'],
];

for (const [pattern, replacement] of replacements) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Patch pattern not found: ${pattern}`);
  text = next;
}

const newHeader = `      <header class="hero">
        <div class="hero-banner" aria-hidden="true">
          <img
            class="hero-banner-image"
            src={heroBanner}
            alt=""
            width="2000"
            height="900"
            fetchpriority="high"
            decoding="async"
          />
          <div class="hero-banner-shade"></div>
        </div>

        <div class="hero-copy">
          <div class="eyebrow">
            <span></span>
            TANZIMFC / FC MOBILE TOOLS
            <b><i></i> LIVE CODE DATABASE</b>
          </div>

          <h1>FC Mobile <em>Redeem Codes</em></h1>

          <p class="hero-lede">
            Find working FC Mobile redeem codes, check whether a code is active,
            copy it in one tap, and continue straight to the official EA redemption page.
          </p>

          <div class="hero-actions">
            <a class="btn btn-primary" href="#live">View active codes <span>↓</span></a>
            <a class="btn btn-ghost" href="https://redeem.fcm.ea.com/" target="_blank" rel="noopener noreferrer">
              Open EA redemption <span>↗</span>
            </a>
          </div>
        </div>

        <div class="hero-showcase" aria-label="FC Mobile redeem code artwork">
          <div class="hero-visual-main">
            <img
              src={heroVisual}
              alt="FC Mobile redeem code artwork"
              width="1000"
              height="1000"
              decoding="async"
            />
          </div>
          <div class="hero-visual-secondary">
            <img
              src={heroRewardVisual}
              alt="FC Mobile reward artwork"
              width="700"
              height="700"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </header>

`;

const headerPattern = /      <header class="hero">[\s\S]*?      <\/header>\n\n/;
if (!headerPattern.test(text)) throw new Error('Redeem hero block not found');
text = text.replace(headerPattern, newHeader);

const stylePattern = /  <style is:global>[\s\S]*?<\/style>\n\n<script define:vars=/;
if (!stylePattern.test(text)) throw new Error('Redeem global hero style block not found');

const newStyle = `  <style is:global>
.codes-page .hero{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(320px,.98fr);align-items:center;min-height:clamp(560px,58vw,720px);margin-bottom:8px;overflow:hidden;border:1px solid #21465c;border-radius:30px;background:#06131d;box-shadow:0 35px 100px #0009,inset 0 0 0 1px #56d6ff12}
.codes-page .hero:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,#031019f5 0%,#06131dcc 30%,#06131d80 55%,#06131d18 78%,transparent 100%),linear-gradient(0deg,#02080dcc 0%,transparent 45%,#02080d33 100%)}
.codes-page .hero-banner{position:absolute;inset:0;z-index:0;overflow:hidden}
.codes-page .hero-banner-image{width:100%;height:100%;display:block;object-fit:cover;object-position:center center;filter:saturate(1.03) contrast(1.02);transform:scale(1.015)}
.codes-page .hero-banner-shade{position:absolute;inset:0;background:radial-gradient(circle at 74% 48%,#56d6ff10,transparent 34%),linear-gradient(180deg,transparent 60%,#02070bbf 100%)}
.codes-page .hero-copy{position:relative;z-index:3;max-width:720px;min-height:clamp(560px,58vw,720px);display:flex;flex-direction:column;justify-content:center;padding:clamp(42px,6vw,82px)}
.codes-page .hero-copy h1{max-width:650px;font-size:clamp(48px,6.5vw,86px);line-height:.94;letter-spacing:-.065em;text-shadow:0 8px 40px #0009}
.codes-page .hero-copy .hero-lede{max-width:590px;color:#d1e3ef}
.codes-page .hero-showcase{position:relative;z-index:3;min-height:clamp(430px,50vw,620px);display:flex;align-items:center;justify-content:center;padding:36px 52px 36px 0}
.codes-page .hero-visual-main{position:relative;width:min(470px,100%);transform:translate(6%,2%) rotate(1.2deg);filter:drop-shadow(0 32px 42px #000a)}
.codes-page .hero-visual-main img{display:block;width:100%;height:auto;max-height:560px;object-fit:contain}
.codes-page .hero-visual-secondary{position:absolute;right:2%;bottom:8%;width:min(210px,31%);transform:rotate(-4deg);filter:drop-shadow(0 24px 32px #000b);transition:transform .22s ease}
.codes-page .hero-visual-secondary:hover{transform:translateY(-5px) rotate(-2deg)}
.codes-page .hero-visual-secondary img{display:block;width:100%;height:auto;object-fit:contain}
.codes-page .seo-expanded{margin-top:22px;padding:34px;border:1px solid #1d3343;border-radius:22px;background:linear-gradient(145deg,#0b151f,#071018)}
.codes-page .seo-expanded h2{margin-bottom:14px}
.codes-page .seo-expanded p{max-width:900px;color:#a9bac8;line-height:1.85}
@media(max-width:1050px){.codes-page .hero{grid-template-columns:1fr;min-height:760px}.codes-page .hero-copy{min-height:430px;max-width:760px;justify-content:end;padding-bottom:8px}.codes-page .hero-showcase{min-height:360px;padding:0 50px 42px}.codes-page .hero-visual-main{width:min(390px,70vw);transform:translateX(-3%)}.codes-page .hero-visual-secondary{width:min(180px,25vw);right:8%;bottom:5%}}
@media(max-width:700px){.codes-page .hero{min-height:720px;border-radius:22px}.codes-page .hero-copy{min-height:0;padding:38px 24px 0;justify-content:flex-start}.codes-page .hero-copy h1{font-size:clamp(42px,12vw,64px)}.codes-page .hero-actions{flex-direction:column}.codes-page .hero-actions .btn{width:100%}.codes-page .hero-showcase{min-height:355px;padding:14px 22px 34px}.codes-page .hero-visual-main{width:min(330px,78vw);transform:translateX(-6%)}.codes-page .hero-visual-secondary{width:min(145px,34vw);right:3%;bottom:4%}.codes-page .hero-banner-image{object-position:62% center}}
</style>

<script define:vars=`;

text = text.replace(stylePattern, newStyle);
fs.writeFileSync(path, text);
console.log('Redeem hero updated with three separate Cloudinary assets');
