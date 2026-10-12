const OUTFIELD_STAT_GROUPS = [
  ["pace", "Pace"],
  ["shooting", "Shooting"],
  ["passing", "Passing"],
  ["dribbling", "Dribbling"],
  ["defending", "Defending"],
  ["physical", "Physical"]
];

const GOALKEEPER_STAT_GROUPS = [
  ["diving", "Diving"],
  ["positioning", "Positioning"],
  ["handling", "Handling"],
  ["reflexes", "Reflexes"],
  ["jumping", "Jumping"],
  ["kicking", "Kicking"]
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function image(url, className, alt = "") {
  const safe = safeImageUrl(url);
  if (!safe) return "";
  return '<img class="' + className + '" src="' + escapeHtml(safe) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" draggable="false">';
}

function statLine(key, label, stats) {
  const raw = stats && stats[key] ? stats[key].value : null;
  const value = raw !== null && raw !== undefined && String(raw).trim() !== "" && Number.isFinite(Number(raw))
    ? Number(raw)
    : null;
  return '<div class="fc-player-stat"><span>' + escapeHtml(label) + '</span><b>' + (value === null ? "—" : value) + '</b></div>';
}

function normalizeNameWord(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeCardName(player) {
  const explicit = String(player.card_display_name || player.cardDisplayName || "").trim();
  if (explicit) return explicit;
  const fullName = String(player.player_name || player.name || "Unknown Player").trim();
  const slug = String(player.source_slug || player.sourceSlug || "").replace(/^\d+-/, "");
  const wanted = slug.split("-").map(normalizeNameWord).filter(Boolean);
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const matched = [];
  for (const slugPart of wanted) {
    const candidate = nameParts.find((part) => normalizeNameWord(part) === slugPart);
    if (candidate && !matched.includes(candidate)) matched.push(candidate);
  }
  if (matched.length) return matched.join(" ");
  const parts = fullName.split(/\s+/);
  return parts.length > 1 ? parts.slice(-1).join("") : fullName;
}

export function renderAnniversaryPlayerCard(player) {
  const name = String(player.player_name || player.name || "Unknown Player").trim();
  const cardName = makeCardName(player);
  const ovr = Number(player.ovr) || "—";
  const position = String(player.position || "—").toUpperCase();
  const template = player.template_key === "anniversary27-live" ? "live" : "base";
  const stats = player.stats || {};
  const details = player.details || {};
  const playerType = player.stat_extraction?.playerType || player.statExtraction?.playerType || (position === "GK" ? "goalkeeper" : "outfield");
  const statGroups = playerType === "goalkeeper" || position === "GK" ? GOALKEEPER_STAT_GROUPS : OUTFIELD_STAT_GROUPS;
  const badges = [
    image(player.nation_flag_url, "fc-card-badge fc-card-badge--nation", details.nation || "Nation"),
    image(player.club_logo_url, "fc-card-badge fc-card-badge--club", details.club || "Club"),
    image(player.league_logo_url, "fc-card-badge fc-card-badge--league", details.league || "League")
  ].filter(Boolean).join("");

  const metaLines = [
    details.club ? '<span class="fc-player-meta__item">' + escapeHtml(details.club) + '</span>' : "",
    details.league ? '<span class="fc-player-meta__item">' + escapeHtml(details.league) + '</span>' : "",
    details.nation ? '<span class="fc-player-meta__item">' + escapeHtml(details.nation) + '</span>' : ""
  ].filter(Boolean).join("");

  const groupStats = statGroups.map(([key, label]) => statLine(key, label, stats)).join("");
  const imageMissing = !safeImageUrl(player.player_image_url);
  const backgroundMissing = !safeImageUrl(player.card_background_url);

  return '<article class="fc-player-tile" data-tier="' + escapeHtml(template) + '" data-position="' + escapeHtml(position) + '" data-card-id="' + escapeHtml(player.source_card_id || "") + '">' +
    '<div class="fc-player-card-art" data-template="' + escapeHtml(template) + '">' +
      image(player.card_background_url, "fc-player-card-art__frame", "") +
      image(player.player_image_url, "fc-player-card-art__athlete", name) +
      '<div class="fc-player-card-art__shade"></div>' +
      '<div class="fc-player-card-art__rating"><strong>' + escapeHtml(ovr) + '</strong><span>' + escapeHtml(position) + '</span></div>' +
      '<div class="fc-player-card-art__badges">' + badges + '</div>' +
      '<div class="fc-player-card-art__name" title="' + escapeHtml(name) + '">' + escapeHtml(cardName) + '</div>' +
      (imageMissing ? '<div class="fc-player-card-art__missing">PLAYER IMAGE MISSING</div>' : '') +
      (backgroundMissing ? '<div class="fc-player-card-art__missing fc-player-card-art__missing--background">TEMPLATE MISSING</div>' : '') +
    '</div>' +
    '<div class="fc-player-tile__body">' +
      '<div class="fc-player-tile__heading"><div><h3>' + escapeHtml(name) + '</h3><p>' + escapeHtml(position) + ' · ' + escapeHtml(ovr) + ' OVR</p></div>' +
      '<span class="fc-player-tier">' + (template === "live" ? "LIVE" : "BASE") + '</span></div>' +
      '<div class="fc-player-meta">' + metaLines + '</div>' +
      '<div class="fc-player-stats">' + groupStats + '</div>' +
      '<div class="fc-player-tile__footer">' +
        (player.skill_points_to_spend === null || player.skill_points_to_spend === undefined ? "" :
          '<span>Skill points to spend <b>' + escapeHtml(player.skill_points_to_spend) + '</b></span>') +
        '<span class="fc-player-template-label">' + escapeHtml(player.template_key || "Anniversary template") + '</span>' +
      '</div>' +
    '</div>' +
  '</article>';
}

export function getAnniversaryPlayerCardEscapeHtml() {
  return escapeHtml;
}
