import { formatCoins, formatCoinsExact } from './formatCoins.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const imagePath = (value) => {
  const url = String(value || '').trim();
  return /^https:\/\//i.test(url) || /^\/assets\//.test(url) ? url : '';
};

export function renderPlayerCard(player = {}) {
  const name = String(player.name || 'Unknown player');
  const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'FC';
  const ovr = Number.isInteger(Number(player.ovr)) ? Number(player.ovr) : '—';
  const tier = Number(ovr) >= 120 ? 'legend' : Number(ovr) >= 116 ? 'elite' : 'standard';
  const event = String(player.event || 'FC Mobile');
  const image = imagePath(player.image);
  const background = imagePath(player.card_background);
  const cardStyle = background ? ` style="--player-card-bg:url(&quot;${esc(background)}&quot;)"` : '';
  const identityMarks = [
    ['club_badge', player.club_badge, player.club],
    ['nation_flag', player.nation_flag, player.nation],
    ['league_logo', player.league_logo, player.league],
  ].filter(([, src]) => imagePath(src)).map(([kind, src, label]) => `<img class="player-card-mark" src="${esc(imagePath(src))}" alt="${esc(label || kind.replace('_',' '))}" title="${esc(label || '')}" loading="lazy" decoding="async">`).join('');
  const portrait = image
    ? `<img class="player-card-image" src="${esc(image)}" alt="${esc(name)} player card" loading="lazy" decoding="async" onerror="this.remove();this.closest('.player-card-art')?.classList.add('image-missing')">`
    : '';
  const sellPrice = Number(player.sell_price?.current_sell_price);
  const price = Number.isFinite(sellPrice) && sellPrice >= 0
    ? `<span class="player-card-price" title="${esc(formatCoinsExact(sellPrice))} coins"><img src="/assets/player-ui/coins.svg" alt="" loading="lazy">${esc(formatCoins(sellPrice))}</span>`
    : '';
  const shards = player.shard_cost
    ? `<span class="player-card-shards"><img src="/assets/player-ui/shards.svg" alt="" loading="lazy">${Number(player.shard_cost.shard_cost).toLocaleString()}</span>`
    : '';
  return `<a class="player-card-shell" href="/player/${encodeURIComponent(player.slug || '')}/" data-player-card="${esc(player.player_id || '')}">
    <div class="player-card-art player-card-tier-${tier}"${cardStyle}>
      <div class="player-card-topline"><span>FC MOBILE</span><span class="player-card-edition">PLAYER DATABASE</span></div>
      <div class="player-card-rating"><b>${esc(ovr)}</b><small>OVR</small><strong>${esc(player.position || '—')}</strong></div>
      <div class="player-card-emblem" aria-label="${esc([player.club,player.nation,player.league].filter(Boolean).join(", ") || "Club, nation and league marks")}">${identityMarks || "FC"}</div>
      <div class="player-card-portrait" aria-label="${esc(name)} player card artwork">
        <div class="player-card-monogram" aria-hidden="true">${esc(initials)}</div>
        ${portrait}
      </div>
      <div class="player-card-identity"><strong>${esc(name)}</strong><span>${esc(event)}</span></div>
      <div class="player-card-footline"><span>FCMOBILETOOLS</span><span>${esc(player.position || 'PLAYER')}</span></div>
      ${price}
      ${shards}
    </div>
    <div class="player-card-copy"><h2>${esc(name)}</h2><p>${esc(event)}</p></div>
  </a>`;
}
