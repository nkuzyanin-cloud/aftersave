# AFTERSAVE: Worker deployment
The GitHub Pages frontend and Cloudflare Worker are separate deployments.
The Worker uses the `STEAM_ACTIVITY` D1 binding, `STEAM_ID`, `STEAM_API_KEY` and `AFTERSAVE_PASSWORD`.
Store secrets in Cloudflare, not Git. The rate limit bindings are in wrangler.toml.
Before moving or deploying the Worker from CLI:
1. Record the actual D1 database ID/name and existing Cron Trigger from the production Cloudflare dashboard.
2. Configure the `STEAM_ACTIVITY` D1 binding and the existing cron schedule in Wrangler without changing their values.
3. Verify the existing schema, including activity.sql, device-session.sql and the steam_feeds table created by feeds.mjs.
4. Verify the /health, login, library, achievements, wishlist and news endpoints. Do not apply schema or retention changes to production without a backup.
This documentation deliberately does not guess the deployed database ID or cron interval. The current production Worker is not changed by frontend refactors.
Run frontend regression tests from the repository root with `npm test` (Node 20+).
