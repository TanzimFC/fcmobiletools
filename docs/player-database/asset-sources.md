# Player database asset sources

| Asset group | Handling | Source / attribution |
| --- | --- | --- |
| Coin, Star Shard, and sell-price indicators | Original SVGs in `public/assets/player-ui/` | Created for FCMOBILETOOLS |
| Pace, shooting, passing, dribbling, defending, and physical UI icons | Original SVG category icons in `public/assets/player-ui/`; these are category visuals, not sourced player-specific PlayStyle records | Created for FCMOBILETOOLS |
| Player portraits | `player_assets` maps source-listed image URLs; local portraits are pending | FC Mobile Squad source URLs; source and reuse status are recorded per player |
| Event card backgrounds | Five Season 10 backgrounds are bundled locally under `public/assets/player-cards/`, with normalized filenames and a source manifest | Sappurit/s10img catalog; source links, source filename, EA attribution, and unverified source terms are retained in the asset registry |
| Club badges, nation flags, league marks, event graphics, rank and trait icons | Not yet populated | Add only with source, attribution, and reuse status recorded |

No Zenith source code or datasets were copied. The first catalog has no verified player-specific PlayStyle, trait, or rank-icon records, so the custom category icons are not presented as those records. The Supabase `player_assets` registry stores asset key, type, URL/path, source, license note, attribution, and optional checksum.

The catalog sync utility reads only the Sappurit HTML filename/link index by default. Optional downloads are bounded with `--limit`, use readable local names, and record source URLs and checksums; they never inspect image pixels. The local card renderer composes the background with FCMOBILETOOLS card typography, player image, OVR, position, and available club/nation/league marks. No Zenith or RenderZ binaries are included.
