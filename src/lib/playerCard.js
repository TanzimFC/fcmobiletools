const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderPlayerCard(player) {
  const initials = player.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const image = player.image ? `<img src="${esc(player.image)}" alt="${esc(player.name)} ${player.ovr} OVR player card" loading="lazy" decoding="async" onerror="this.remove()">` : '';
  const shards = player.shard_cost ? `<span class="player-card-shards">✦ ${Number(player.shard_cost.shard_cost).toLocaleString()} shards</span>` : '';
  return `<a class="player-card-shell" href="/player/${encodeURIComponent(player.slug)}/"><div class="player-card-art"><div class="player-card-fallback" aria-hidden="true">${esc(initials)}</div>${image}<span class="player-card-ovr"><b>${player.ovr}</b><small>OVR</small></span><span class="player-card-position">${esc(player.position)}</span>${shards}</div><div class="player-card-copy"><h2>${esc(player.name)}</h2><p>${esc(player.event || 'FC Mobile player')}</p></div></a>`;
}
