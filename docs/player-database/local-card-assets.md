# Local event card art

The initial local pack includes five Season 10 FC Mobile card backgrounds. Filenames are normalized for the FCMOBILETOOLS bundle; source names and attribution are in s10img-asset-manifest.json.

| Event | Treatment | Local asset | Catalog source name |
| --- | --- | --- | --- |
| Team of the Year | Base | /assets/player-cards/team-of-the-year-base.png | backgrounds_TOTY26_BASE.png |
| Team of the Season | Base | /assets/player-cards/team-of-the-season-base.png | backgrounds_TOTS26_BASE.png |
| Star Signings | Live | /assets/player-cards/star-signings-live.png | backgrounds_SS26_LIVE.png |
| Champions League | Live | /assets/player-cards/champions-league-live.png | backgrounds_CL26_LIVE.png |
| Anniversary | Live | /assets/player-cards/anniversary-live.png | backgrounds_ANN26_LIVE.png |

Run node scripts/player-data/scrape-s10img-assets.mjs --category=backgrounds --manifest=/tmp/fcm-assets.json to refresh the name/URL catalog without opening images. Add --download --limit=64 to download a bounded selection into public/assets/player-cards/s10img/. Images are checked by signature and size, not visually inspected.

The current card renderer uses an explicitly assigned local card_background where available. It does not guess event variants; assign the correct background to each imported player record after verifying its event.

The index is a community archive of EA game art and provides no per-file license metadata. This repository retains attribution and records the project owner's stated upload permission while noting the source terms are unverified.
