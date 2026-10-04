# Dragon Roster

A responsive Dragon City collection tracker inspired by Ditlep's dark battle-league ranking UI. Uses real Ditlep data, not sample scores.

[Live app](https://dragon-roster.vercel.app) · [GitHub repository](https://github.com/jeremiahdanielregalario/dragon-roster)

- All five ranking modes: General, Damage, Tank, Support, Arena.
- Search by dragon, family, or skill; filter by rarity and element.
- Owned, newly acquired, and can-summon lists. Acquired dragons count as owned.
- Email magic-link sign-in and private cross-device collections with Supabase.
- Daily source checks, owner-only manual refresh, rank movement, and the last 30 changed snapshots.
- JSON backup export/import and device-to-cloud collection import.
- Phone layout, dark/light themes, home-screen icons and web app manifest.

Read **[SETUP.md](SETUP.md)** for database setup, GitHub/Vercel publishing, and everyday use.

## Local development

Requires Node.js 22 or newer (CI uses Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The app works with a bundled real ranking snapshot and a device-local collection before cloud setup. It clearly labels this mode. Live refresh, scheduled history and account sync require the database and environment variables in the setup guide.

```sh
npm test
npm run build
npm run typecheck
```

Tests run against a local PostgreSQL-compatible PGlite engine and cover row-level security, denied anonymous access, protected service functions, refresh leases and cooldowns, unchanged-snapshot deduplication, history retention, incomplete-source rejection, filtering and backup validation.

An optional GitHub Actions template is in `scripts/github-actions-check.yml`. To enable it, copy it to `.github/workflows/check.yml` through GitHub's web editor or push with credentials that include the `workflow` scope. Vercel deployments do not depend on this optional workflow.

## Architecture

Next.js App Router on Vercel. The browser reads public rankings from `/api/rankings`; user collections go directly to Supabase with a publishable key and row-level security. Service-role credentials stay on the server. `/api/sync` accepts a Vercel cron secret for scheduled GET requests, or the configured owner's verified Supabase session for POST requests.

Ranking refreshes fetch Ditlep's public `/Dragon/Search` feed, validate every record and the full item count, acquire a database lease and atomically publish complete snapshots. No changes are committed when the source fails. Requests are limited to once an hour globally with a five-minute failure cooldown. Public API responses are cached for 60 seconds. The screen rereads saved rankings and collections every minute while visible and on focus.

Collection writes are per dragon, avoiding full-list overwrites across devices. Changes to the same dragon on two devices use last-write-wins. Cloud read/write failures are visible and do not silently discard a selection. Guest data stays separate until explicitly imported.

`data/rankings.json` is the initial real snapshot. `npm run refresh:seed` updates that fallback manually; normal scheduled updates are stored in Supabase, without rebuilding the site. The source adapter is isolated in `lib/ditlep.ts` for maintenance if Ditlep changes its unofficial endpoint.

This tracker does not access your Dragon City account, inventory, or orb balance. Collection statuses are manually selected. Rank numbers and confidence are Ditlep's model outputs, not guarantees of battle performance. Dragon artwork is served from the same Socialpoint CDN used by the source. This is an independent fan project, not affiliated with Ditlep or Socialpoint.
