export const config = {
  sourceBaseUrl: process.env.UPSTREAM_BASE_URL ?? "",
  searchEndpoint: process.env.UPSTREAM_SEARCH_ENDPOINT ?? "",
  sourceCookie: process.env.UPSTREAM_COOKIE ?? "",
  sourceToken: process.env.UPSTREAM_SECURE_TOKEN ?? "",
  sourceFingerprint: process.env.UPSTREAM_CLIENT_FINGERPRINT ?? "",
  pageSize: Number(process.env.PLAYER_PAGE_SIZE ?? 1000),
  requestDelayMs: Number(process.env.PLAYER_REQUEST_DELAY_MS ?? 350),
  outputDir: process.env.PLAYER_PIPELINE_OUTPUT ?? "scripts/player-pipeline/data",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};