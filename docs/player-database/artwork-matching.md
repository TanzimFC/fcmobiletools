# Player artwork matching

player_assets supports reusable global mappings through match_field and match_key. Player-specific artwork takes precedence. A global mapping can target event, club, nation, league, player ID, playstyle, trait, or rank.

Import up to 500 mappings from the Players admin panel using a JSON array or an object with an assets array. Each row includes asset_key, asset_type, match_field, match_key, and either an approved repository path under /assets/ or an HTTPS URL, plus source and attribution details. The public renderer resolves player images, card backgrounds, nation flags, club badges and league logos from these records without player-specific frontend code.

For Wednesday/Thursday catalog updates, import verified JSON/CSV data through the Players admin panel. This is a manual trigger; it does not poll or scrape RenderZ. Add event-frame and badge mappings through the artwork-map importer. Player catalog responses are cacheable for five minutes, so successful manual imports appear on the public pages after the short cache window. Keep unverified source values blank instead of inventing them.
