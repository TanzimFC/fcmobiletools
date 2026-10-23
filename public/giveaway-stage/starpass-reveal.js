// FCMobiletools: isolated Ballon d'Or Star Pass winner reveal.
// This stage deliberately never renders or scrolls participant names. The winner is
// created once, after the suspense animation has finished, and never changes afterward.
const STYLE_ID = 'fcmt-starpass-reveal-style';
const STAGE_ID = 'fcmt-starpass-reveal-stage';
const DURATION = Object.freeze({ quick: 12000, standard: 22000, epic: 32000 });
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const CSS = [
'.fcmt-br{--br-cyan:#4cc9ff;--br-gold:#f6c453;--br-ink:#06101a;position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;background:radial-gradient(ellipse at 72% 44%,rgba(33,107,143,.22),transparent 43%),radial-gradient(ellipse at 22% 85%,rgba(246,196,83,.09),transparent 38%),#06101a;color:#f5f8fb;font-family:Inter,Arial,sans-serif;isolation:isolate}',
'.fcmt-br *{box-sizing:border-box}.fcmt-br [hidden]{display:none!important}.fcmt-br:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(90deg,#000,transparent 86%)}',
'.fcmt-br-glow{position:absolute;inset:-30%;z-index:-1;pointer-events:none;background:conic-gradient(from 0deg at 70% 42%,transparent 0deg,rgba(76,201,255,.07) 55deg,transparent 110deg,rgba(246,196,83,.06) 180deg,transparent 235deg);animation:fcmtBrGlow 18s linear infinite}',
'.fcmt-br-head{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:clamp(16px,3vw,32px) clamp(20px,4vw,56px);border-bottom:1px solid rgba(255,255,255,.09)}',
'.fcmt-br-brand{display:flex;align-items:center;gap:15px;min-width:0}.fcmt-br-logo{display:block;width:clamp(74px,9vw,116px);height:auto;object-fit:contain;filter:drop-shadow(0 6px 24px rgba(76,201,255,.13))}.fcmt-br-brandtxt{display:grid;gap:4px}.fcmt-br-brandtxt strong{font-size:clamp(14px,1.5vw,18px);font-weight:800;letter-spacing:.13em}.fcmt-br-brandtxt span{font-size:10px;color:#8fa4b8;letter-spacing:.2em;text-transform:uppercase}',
'.fcmt-br-tag{flex:0 0 auto;display:flex;align-items:center;gap:9px;border:1px solid rgba(246,196,83,.3);background:rgba(246,196,83,.07);border-radius:99px;padding:10px 14px;color:#ffe6a2;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.fcmt-br-led{width:7px;height:7px;border-radius:50%;background:var(--br-gold);box-shadow:0 0 14px rgba(246,196,83,.8)}',
'.fcmt-br-main{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,.94fr) minmax(360px,1.06fr);align-items:center;gap:clamp(22px,5vw,82px);width:min(1500px,100%);margin:0 auto;padding:clamp(18px,4vh,48px) clamp(24px,6vw,90px);min-height:0}',
'.fcmt-br-copy{position:relative;z-index:3;max-width:600px}.fcmt-br-eyebrow{display:flex;align-items:center;gap:11px;margin-bottom:22px;color:var(--br-cyan);font-size:11px;font-weight:800;letter-spacing:.24em;text-transform:uppercase}.fcmt-br-eyebrow:before{content:"";width:32px;height:1px;background:var(--br-cyan);box-shadow:0 0 12px rgba(76,201,255,.7)}',
'.fcmt-br-title{margin:0;max-width:620px;font-size:clamp(42px,6vw,88px);font-weight:800;line-height:.96;letter-spacing:-.065em}.fcmt-br-title span{display:block;color:#f6c453;text-shadow:0 0 34px rgba(246,196,83,.12)}.fcmt-br-sub{max-width:460px;margin:20px 0 0;color:#a7b4c3;font-size:clamp(14px,1.4vw,17px);line-height:1.8}',
'.fcmt-br-facts{display:flex;gap:12px;flex-wrap:wrap;margin-top:clamp(24px,4vh,42px)}.fcmt-br-fact{min-width:145px;padding:15px 18px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:linear-gradient(145deg,rgba(20,39,55,.75),rgba(8,20,31,.7));box-shadow:0 14px 40px rgba(0,0,0,.14)}.fcmt-br-fact small{display:block;color:#899daf;font-size:9px;letter-spacing:.18em;text-transform:uppercase}.fcmt-br-fact strong{display:block;margin-top:7px;font-size:clamp(17px,1.7vw,23px);font-weight:800;color:#f5f8fb}',
'.fcmt-br-status{display:flex;align-items:center;gap:10px;margin-top:clamp(22px,4vh,38px);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#dae5ee}.fcmt-br-status i{width:8px;height:8px;border-radius:50%;background:var(--br-cyan);box-shadow:0 0 14px rgba(76,201,255,.7);animation:fcmtBrPulse 1.5s ease-in-out infinite}.fcmt-br-status[data-state="winner"] i{background:var(--br-gold);box-shadow:0 0 16px rgba(246,196,83,.9);animation:none}',
'.fcmt-br-wheelzone{position:relative;display:grid;place-items:center;justify-self:center;width:min(48vw,62vh,610px);min-width:330px;aspect-ratio:1;isolation:isolate}.fcmt-br-wheelzone:before{content:"";position:absolute;inset:7%;border-radius:50%;background:rgba(76,201,255,.06);filter:blur(40px)}',
'.fcmt-br-orbit{position:absolute;inset:2%;border:1px solid rgba(76,201,255,.22);border-radius:50%;box-shadow:0 0 45px rgba(76,201,255,.07),inset 0 0 45px rgba(76,201,255,.04)}.fcmt-br-orbit:before,.fcmt-br-orbit:after{content:"";position:absolute;inset:7%;border:1px dashed rgba(255,255,255,.14);border-radius:50%}.fcmt-br-orbit:after{inset:15%;border-style:solid;border-color:rgba(246,196,83,.23)}',
'.fcmt-br-wheel{position:absolute;inset:14%;border-radius:50%;padding:12px;background:conic-gradient(from -8deg,#15374b 0 8deg,#f6c453 8deg 10deg,#0b1a28 10deg 20deg,#235b73 20deg 25deg,#0b1a28 25deg 35deg,#4cc9ff 35deg 37deg,#15374b 37deg 50deg,#0b1a28 50deg 61deg,#f6c453 61deg 63deg,#17394e 63deg 79deg,#0b1a28 79deg 90deg);box-shadow:0 22px 70px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.2),0 0 60px rgba(76,201,255,.1);transform:rotate(0deg)}.fcmt-br-wheel:before{content:"";position:absolute;inset:8%;border:1px solid rgba(246,196,83,.5);border-radius:50%;box-shadow:inset 0 0 22px rgba(246,196,83,.07)}.fcmt-br-wheel:after{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.19) 0deg .7deg,transparent .7deg 15deg);mask-image:radial-gradient(circle,#0000 0 47%,#000 48% 100%)}',
'.fcmt-br-wheel.is-spinning{animation:fcmtBrSpin var(--fcmt-br-duration,22000ms) cubic-bezier(.08,.66,.12,1) forwards}.fcmt-br-wheel.is-paused{animation-play-state:paused}',
'.fcmt-br-hub{position:absolute;inset:33%;z-index:2;display:grid;place-items:center;border:1px solid rgba(255,255,255,.19);border-radius:50%;background:radial-gradient(circle at 35% 28%,#1b3547,#07121c 72%);box-shadow:0 0 0 8px rgba(5,14,22,.7),0 0 0 9px rgba(246,196,83,.26),0 0 50px rgba(0,0,0,.6)}.fcmt-br-hub img{width:66%;height:auto;object-fit:contain;opacity:.95}.fcmt-br-pointer{position:absolute;top:7%;left:50%;z-index:5;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:31px solid #ffe29a;filter:drop-shadow(0 5px 12px rgba(246,196,83,.6))}',
'.fcmt-br-spark{position:absolute;width:7px;height:7px;border-radius:50%;background:#f6c453;box-shadow:0 0 18px rgba(246,196,83,.8)}.fcmt-br-spark.s1{left:12%;top:33%}.fcmt-br-spark.s2{right:11%;top:66%;width:5px;height:5px;background:#4cc9ff;box-shadow:0 0 18px rgba(76,201,255,.8)}.fcmt-br-spark.s3{right:23%;top:8%;width:4px;height:4px}.fcmt-br-wheelzone.is-landed .fcmt-br-orbit{border-color:rgba(246,196,83,.5);box-shadow:0 0 65px rgba(246,196,83,.15),inset 0 0 45px rgba(246,196,83,.06)}',
'.fcmt-br-winner{position:relative;display:grid;justify-items:start;gap:14px;margin-top:26px;padding:24px 26px;border:1px solid rgba(246,196,83,.42);border-radius:20px;background:linear-gradient(145deg,rgba(246,196,83,.12),rgba(13,27,39,.94));box-shadow:0 20px 65px rgba(0,0,0,.32),0 0 50px rgba(246,196,83,.08);animation:fcmtBrWinnerIn .85s cubic-bezier(.16,1,.3,1) both}.fcmt-br-winner-label{color:#f6c453;font-size:10px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}.fcmt-br-winner-name{margin:0;color:#fff2c7;font-size:clamp(44px,6vw,78px);font-weight:900;line-height:.98;letter-spacing:-.06em;text-shadow:0 0 36px rgba(246,196,83,.17)}.fcmt-br-winner-prize{color:#d3dde6;font-size:14px;line-height:1.6}.fcmt-br-check{display:flex;align-items:center;gap:8px;color:#8fe0ad;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.fcmt-br-check:before{content:"";width:7px;height:7px;border-radius:50%;background:#47d16c;box-shadow:0 0 10px rgba(71,209,108,.5)}',
'.fcmt-br.is-revealed .fcmt-br-title{font-size:clamp(30px,4vw,56px)}.fcmt-br.is-revealed .fcmt-br-title span{color:#f6c453}.fcmt-br.is-revealed .fcmt-br-wheel{filter:saturate(.82);box-shadow:0 22px 70px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.2),0 0 70px rgba(246,196,83,.12)}.fcmt-br.is-revealed .fcmt-br-wheelzone{animation:fcmtBrLand .8s ease-out both}',
'.fcmt-br-foot{position:relative;z-index:2;display:grid;gap:14px;padding:0 clamp(20px,4vw,56px) clamp(18px,3vw,30px)}.fcmt-br-footrow{display:flex;align-items:center;justify-content:space-between;gap:16px;color:#8fa4b8;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.fcmt-br-progress{height:3px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.09)}.fcmt-br-progress span{display:block;width:0;height:100%;background:linear-gradient(90deg,#4cc9ff,#f6c453);box-shadow:0 0 20px rgba(76,201,255,.55);transition:width .08s linear}',
'.fcmt-br-controls{position:absolute;right:clamp(20px,4vw,56px);bottom:clamp(40px,7vh,72px);z-index:8;display:flex;gap:8px}.fcmt-br-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 13px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(8,20,31,.78);color:#f5f8fb;font:700 11px Inter,Arial,sans-serif;cursor:pointer;backdrop-filter:blur(12px);transition:background .18s,border-color .18s,transform .18s}.fcmt-br-btn:hover{border-color:rgba(76,201,255,.45);background:rgba(25,52,70,.92);transform:translateY(-1px)}.fcmt-br-btn:focus-visible{outline:2px solid #4cc9ff;outline-offset:3px}.fcmt-br-btn[disabled]{opacity:.4;cursor:not-allowed}',
'.fcmt-br.is-revealed .fcmt-br-copy .fcmt-br-sub{display:none}.fcmt-br.is-revealed .fcmt-br-status{color:#ffe7a6}.fcmt-br.is-revealed .fcmt-br-status i{background:#f6c453}',
'@keyframes fcmtBrSpin{0%{transform:rotate(0deg)}100%{transform:rotate(2520deg)}}@keyframes fcmtBrGlow{to{transform:rotate(360deg)}}@keyframes fcmtBrPulse{0%,100%{opacity:.45;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}@keyframes fcmtBrWinnerIn{0%{opacity:0;transform:translateY(18px) scale(.98);filter:blur(8px)}100%{opacity:1;transform:translateY(0) scale(1);filter:none}}@keyframes fcmtBrLand{0%{transform:scale(.97)}50%{transform:scale(1.025)}100%{transform:scale(1)}}',
'.fcmt-br.is-paused .fcmt-br-glow,.fcmt-br.is-paused .fcmt-br-status i,.fcmt-br.is-paused .fcmt-br-winner{animation-play-state:paused}.fcmt-br.is-revealed .fcmt-br-glow{animation-duration:45s}',
'@media(max-width:850px){.fcmt-br-main{grid-template-columns:1fr;gap:14px;padding:18px 24px 94px;align-content:center;overflow:auto}.fcmt-br-copy{max-width:100%}.fcmt-br-title{font-size:clamp(38px,8vw,65px)}.fcmt-br-sub{margin-top:12px;line-height:1.6}.fcmt-br-facts{margin-top:16px}.fcmt-br-fact{padding:10px 13px;min-width:120px}.fcmt-br-status{margin-top:15px}.fcmt-br-wheelzone{width:min(54vw,34vh,360px);min-width:230px;grid-row:1}.fcmt-br-copy{grid-row:2}.fcmt-br-winner{margin-top:16px}.fcmt-br-controls{left:20px;right:20px;bottom:14px;justify-content:center;flex-wrap:wrap}.fcmt-br-btn{min-height:36px}.fcmt-br-foot{padding-bottom:74px}.fcmt-br-head{padding:12px 18px}.fcmt-br-logo{width:68px}.fcmt-br-brandtxt span{font-size:8px}.fcmt-br-tag{font-size:8px;padding:8px 10px}}',
'@media(max-height:620px) and (min-width:851px){.fcmt-br-main{padding-top:12px;padding-bottom:16px}.fcmt-br-wheelzone{width:min(39vw,54vh,480px)}.fcmt-br-title{font-size:clamp(38px,5vw,70px)}.fcmt-br-foot{padding-bottom:14px}.fcmt-br-controls{bottom:40px}}',
'@media(prefers-reduced-motion:reduce){.fcmt-br-glow,.fcmt-br-status i,.fcmt-br-wheel.is-spinning{animation:none!important}.fcmt-br-winner{animation:none!important}.fcmt-br *{scroll-behavior:auto!important}}'
].join('\n');

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function tone(ctx, frequency, seconds, type, volume) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume || 0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + seconds);
  } catch { /* Audio is optional for screen recording. */ }
}

export function playStarPassReveal(options = {}) {
  const previous = document.getElementById(STAGE_ID);
  if (previous) previous.remove();
  installStyle();

  const speed = Object.prototype.hasOwnProperty.call(DURATION, options.speed) ? options.speed : 'standard';
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1500 : DURATION[speed];
  const participantCount = Math.max(0, Math.floor(Number(options.participantCount) || 0));
  const prize = String(options.prize || 'Star Pass').slice(0, 100);
  const title = String(options.title || "Ballon d'Or Star Pass Giveaway").slice(0, 100);
  let audio = null;
  let soundOn = Boolean(options.sound);
  let elapsed = 0;
  let last = performance.now();
  let timer = 0;
  let revealed = false;
  let closed = false;
  let paused = false;
  const previousOverflow = document.documentElement.style.overflow;
  const previousFocus = document.activeElement;

  const root = document.createElement('section');
  root.id = STAGE_ID;
  root.className = 'fcmt-br';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Ballon d’Or Star Pass giveaway winner reveal');
  root.tabIndex = -1;
  root.style.setProperty('--fcmt-br-duration', duration + 'ms');
  root.innerHTML = ''
    + '<div class="fcmt-br-glow" aria-hidden="true"></div>'
    + '<header class="fcmt-br-head">'
    + ' <div class="fcmt-br-brand"><img class="fcmt-br-logo" src="/assets/images/logo.png" alt="FCMobiletools" width="180" height="90">'
    + ' <div class="fcmt-br-brandtxt"><strong>FCMOBILETOOLS</strong><span>Giveaway night</span></div></div>'
    + ' <div class="fcmt-br-tag"><i class="fcmt-br-led"></i><span data-br-tag>Winner reveal</span></div>'
    + '</header>'
    + '<main class="fcmt-br-main">'
    + ' <section class="fcmt-br-copy">'
    + '  <div class="fcmt-br-eyebrow" data-br-eyebrow>THE DRAW IS LOCKED</div>'
    + '  <h1 class="fcmt-br-title" data-br-title>One reward.<span>One winner.</span></h1>'
    + '  <p class="fcmt-br-sub" data-br-sub>All entries are in. The final reveal is about to begin.</p>'
    + '  <div class="fcmt-br-facts">'
    + '   <div class="fcmt-br-fact"><small>Entries included</small><strong>' + participantCount.toLocaleString() + '</strong></div>'
    + '   <div class="fcmt-br-fact"><small>Reward</small><strong>' + esc(prize) + '</strong></div>'
    + '  </div>'
    + '  <div class="fcmt-br-status" data-br-status data-state="running"><i></i><span>Securing the entry pool</span></div>'
    + '  <div class="fcmt-br-winner" data-br-winner hidden>'
    + '   <div class="fcmt-br-winner-label">Winner confirmed</div>'
    + '   <h2 class="fcmt-br-winner-name" data-br-winner-name></h2>'
    + '   <div class="fcmt-br-winner-prize" data-br-winner-prize></div>'
    + '   <div class="fcmt-br-check">Result locked</div>'
    + '  </div>'
    + ' </section>'
    + ' <div class="fcmt-br-wheelzone" data-br-wheelzone aria-hidden="true">'
    + '  <div class="fcmt-br-orbit"></div>'
    + '  <div class="fcmt-br-wheel" data-br-wheel><div class="fcmt-br-hub"><img src="/assets/images/logo.png" alt=""></div></div>'
    + '  <div class="fcmt-br-pointer"></div><i class="fcmt-br-spark s1"></i><i class="fcmt-br-spark s2"></i><i class="fcmt-br-spark s3"></i>'
    + ' </div>'
    + '</main>'
    + '<footer class="fcmt-br-foot">'
    + ' <div class="fcmt-br-footrow"><span data-br-footer>Preparing final reveal</span><span data-br-time>' + Math.round(duration / 1000) + 's</span></div>'
    + ' <div class="fcmt-br-progress" aria-hidden="true"><span data-br-progress></span></div>'
    + '</footer>'
    + '<nav class="fcmt-br-controls" aria-label="Animation controls">'
    + ' <button class="fcmt-br-btn" type="button" data-br-action="pause">Pause</button>'
    + ' <button class="fcmt-br-btn" type="button" data-br-action="sound" aria-pressed="' + String(soundOn) + '">Sound ' + (soundOn ? 'on' : 'off') + '</button>'
    + ' <button class="fcmt-br-btn" type="button" data-br-action="skip">Reveal now</button>'
    + ' <button class="fcmt-br-btn" type="button" data-br-action="full">Fullscreen</button>'
    + ' <button class="fcmt-br-btn" type="button" data-br-action="close">Close</button>'
    + '</nav>';
  document.body.appendChild(root);
  document.documentElement.style.overflow = 'hidden';

  const $ = (selector) => root.querySelector(selector);
  const wheel = $('[data-br-wheel]');
  const progress = $('[data-br-progress]');
  const time = $('[data-br-time]');
  const status = $('[data-br-status]');
  const statusText = status.querySelector('span');
  const footer = $('[data-br-footer]');
  const pauseButton = $('[data-br-action="pause"]');
  const soundButton = $('[data-br-action="sound"]');

  const audioContext = () => {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) window.clearInterval(timer);
    root.remove();
    document.documentElement.style.overflow = previousOverflow;
    document.removeEventListener('keydown', onKey, true);
    try { previousFocus?.focus?.({ preventScroll: true }); } catch {}
    try { audio?.close?.(); } catch {}
  };

  const reveal = () => {
    if (revealed || closed) return;
    revealed = true;
    elapsed = duration;
    if (timer) window.clearInterval(timer);
    root.classList.remove('is-paused');
    root.classList.add('is-revealed');
    wheel.classList.remove('is-spinning', 'is-paused');
    wheel.style.animation = 'none';
    wheel.style.transform = 'rotate(2520deg)';
    $('[data-br-tag]').textContent = 'Winner confirmed';
    $('[data-br-eyebrow]').textContent = 'THE RESULT IS IN';
    $('[data-br-title]').textContent = 'The winner is';
    $('[data-br-sub]').hidden = true;
    status.dataset.state = 'winner';
    statusText.textContent = 'Winner confirmed';
    footer.textContent = 'Result locked';
    time.textContent = 'DONE';
    progress.style.width = '100%';
    $('[data-br-winner-name]').textContent = 'Bunty';
    $('[data-br-winner-prize]').textContent = prize + ' · Congratulations!';
    $('[data-br-winner]').hidden = false;
    $('[data-br-action="skip"]').hidden = true;
    pauseButton.hidden = true;
    if (soundOn) {
      const ctx = audioContext();
      if (ctx) { tone(ctx, 660, 0.22, 'sine', 0.05); window.setTimeout(() => tone(ctx, 880, 0.38, 'sine', 0.045), 150); }
    }
  };

  const setPaused = (value) => {
    if (revealed || closed) return;
    paused = value === undefined ? !paused : Boolean(value);
    root.classList.toggle('is-paused', paused);
    wheel.classList.toggle('is-paused', paused);
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    last = performance.now();
    if (paused) footer.textContent = 'Paused';
  };

  const onKey = (event) => {
    if (closed) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === ' ' && !/INPUT|TEXTAREA|BUTTON/.test(event.target?.tagName || '')) { event.preventDefault(); setPaused(); }
    else if (event.key.toLowerCase() === 'n') reveal();
    else if (event.key.toLowerCase() === 'f') root.requestFullscreen?.().catch(() => {});
    else if (event.key.toLowerCase() === 's') soundButton.click();
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-br-action]');
    if (!button || button.disabled || revealed && button.dataset.brAction !== 'close') return;
    switch (button.dataset.brAction) {
      case 'pause': setPaused(); break;
      case 'sound':
        soundOn = !soundOn;
        button.textContent = 'Sound ' + (soundOn ? 'on' : 'off');
        button.setAttribute('aria-pressed', String(soundOn));
        if (soundOn) { const ctx = audioContext(); if (ctx) tone(ctx, 520, 0.12, 'sine', 0.028); }
        break;
      case 'skip': reveal(); break;
      case 'full':
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else root.requestFullscreen?.().catch(() => {});
        break;
      case 'close': close(); break;
    }
  });

  document.addEventListener('keydown', onKey, true);
  root.focus({ preventScroll: true });

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The artwork spins; no candidate/winner names are shown during this phase.
  wheel.classList.add('is-spinning');
  root.style.setProperty('--fcmt-br-duration', duration + 'ms');
  void wheel.offsetWidth;
  const startedAt = performance.now();
  last = startedAt;
  timer = window.setInterval(() => {
    if (closed || revealed) return;
    const now = performance.now();
    if (paused) { last = now; return; }
    elapsed += now - last;
    last = now;
    const fraction = Math.min(1, elapsed / duration);
    progress.style.width = (fraction * 100).toFixed(2) + '%';
    time.textContent = Math.max(0, Math.ceil((duration - elapsed) / 1000)) + 's';
    if (fraction < 0.28) { statusText.textContent = 'Securing the entry pool'; footer.textContent = 'Entries locked'; }
    else if (fraction < 0.67) { statusText.textContent = 'Drawing the winner'; footer.textContent = 'Draw in progress'; }
    else if (fraction < 0.92) { statusText.textContent = 'Slowing the wheel'; footer.textContent = 'Final phase'; }
    else { statusText.textContent = 'Preparing the reveal'; footer.textContent = 'Almost there'; }
    if (elapsed >= duration) reveal();
  }, reduceMotion ? 80 : 40);

  if (soundOn) {
    const ctx = audioContext();
    if (ctx) tone(ctx, 330, 0.1, 'sine', 0.018);
  }

  return { close, reveal, pause: setPaused, element: root };
}
