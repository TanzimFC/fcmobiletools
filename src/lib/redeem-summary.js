// Small, shared redeem-code snapshot for surfaces that only need the current status.
// The full public payload remains the source of truth; this helper only shapes its data.
export function summarizeRedeemPayload(payload = {}) {
  const serverDate = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.serverDate || ''))
    ? String(payload.serverDate)
    : new Date().toISOString().slice(0, 10);
  const codes = Array.isArray(payload.codes) ? payload.codes : [];
  const ordered = codes.slice().sort((a, b) =>
    String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')) ||
    String(a.code || '').localeCompare(String(b.code || ''))
  );
  const activeCodes = ordered.filter((code) =>
    code?.status === 'active' &&
    code.community?.state !== 'possibly_expired' && // players report it as dead
    (!code.expiryDate || String(code.expiryDate) >= serverDate)
  );
  const verifiedDates = ordered
    .map((code) => String(code.lastVerified || ''))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  return {
    version: 1,
    serverDate,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || null,
    total: ordered.length,
    activeCount: activeCodes.length,
    newestActive: activeCodes[0] || null,
    recentCodes: ordered.slice(0, 3),
    lastVerified: verifiedDates.at(-1) || null
  };
}
