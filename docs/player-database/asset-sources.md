# Player database asset sources

| Asset group | Handling | Source / attribution |
| --- | --- | --- |
| Coin, Star Shard, and sell-price indicators | Original SVGs in `public/assets/player-ui/` | Created for FCMOBILETOOLS |
| Pace, shooting, passing, dribbling, defending, and physical UI icons | Original SVG category icons in `public/assets/player-ui/`; these are category visuals, not sourced player-specific PlayStyle records | Created for FCMOBILETOOLS |
| Player-card artwork | `player_assets` maps source-listed image URLs for lazy display; the binary files are not mirrored into this source commit | Image URLs listed by [FC Mobile Squad](https://fcmobilesquad.com/star-signings-players); project owner confirms permission for EA in-game art reuse; source attribution is retained in Supabase |
| Club badges, nation flags, league marks, event graphics, rank and trait icons | Not yet populated | Add only with source, attribution, and reuse status recorded |

No Zenith source code or datasets were copied. The first catalog has no verified player-specific PlayStyle, trait, or rank-icon records, so the custom category icons are not presented as those records. The Supabase `player_assets` registry stores asset key, type, URL/path, source, license note, attribution, and optional checksum.