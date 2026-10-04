export const prerender = false;

const SUPABASE_URL = "https://moczgrwxtfexdbjthxpd.supabase.co";
const SUPABASE_KEY = "sb_publishable_twe_ZNKiHXUB4b_J_RjGEA_rPKZrqbr";
const SITE = "https://fcmobiletools.online";

export async function GET() {
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/players?select=slug,updated_at,date_added&active=eq.true&order=slug&limit=50000",
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      }
    }
  );

  if (!response.ok) {
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
  }

  const players = await response.json();
  const escapeXml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  const urls = players
    .filter((player) => player.slug)
    .map((player) => {
      const updated = player.updated_at || player.date_added;
      const lastmod = updated ? "<lastmod>" + escapeXml(new Date(updated).toISOString()) + "</lastmod>" : "";
      return "<url><loc>" + escapeXml(SITE + "/player/" + player.slug + "/") + "</loc>" + lastmod + "</url>";
    })
    .join("");

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls +
      "</urlset>",
    {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600"
      }
    }
  );
}
