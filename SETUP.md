# Dragon Roster setup and use

## This installation

The app is live at **https://dragon-roster.vercel.app**. The Supabase Free-plan project, database tables, row-level security, production environment variables, email redirect URLs, and daily Vercel cron configuration have already been set up.

- [Live tracker](https://dragon-roster.vercel.app)
- [GitHub repository](https://github.com/jeremiahdanielregalario/dragon-roster)
- [Vercel project](https://vercel.com/bright-887d/dragon-roster)
- [Supabase project](https://supabase.com/dashboard/project/btxxkkvauxxwwokmppwv)

To start using it, sign in with your configured owner email on each device and mark your dragons. You do **not** need to repeat the database steps below. They explain how the setup works and how to recreate it. The initial cloud snapshot contains 2,237 dragons. History will grow when the source rankings change.

The generated database password is saved locally in `.env.supabase.admin` with owner-only file permissions. This file and `.env.local` are excluded from Git and Vercel uploads. Keep a private backup of the database password in your password manager.

## Why Supabase

For this tracker, Supabase combines PostgreSQL, email sign-in and private per-user storage in one service. There is no need for a separate authentication server, Redis service, or paid database just to start. A collection stores only dragon IDs and statuses; the shared ranking dataset is saved once for everyone. Only changed snapshots are retained, capped at 30, to limit storage growth.

Use a separate Free-plan project for Dragon Roster. Check the plan before creating it: projects inside a paid organization may incur compute charges. Free-plan quotas and inactivity policies can change; check the [current pricing](https://supabase.com/pricing). Vercel Hobby supports the daily schedule used here; [Hobby cron jobs run once per day within the scheduled hour](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 1. Create the database

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and create a project named **Dragon Roster** in a Free-plan organization. Singapore is a practical nearby region for the Philippines.
2. Save the database password in your password manager. The app itself uses API keys rather than a database password.
3. Open **SQL Editor → New query**. Paste the complete contents of [`supabase/migrations/001_tracker.sql`](supabase/migrations/001_tracker.sql), then click **Run**. Run it once in the new project.
4. This creates `dragon_collection`, `ranking_snapshots`, and `ranking_sync`. Row-level security ensures signed-in users only see their own collection. Ranking writes and maintenance functions are server-only.
5. From the project's **Connect / API settings**, copy the Project URL and publishable key (or legacy `anon` key). From **Settings → API Keys**, copy the legacy service-role key for the server. Do not paste that secret into chat, GitHub, or client code.

The security model follows [Supabase's row-level security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). The SQL is tested locally with two separate simulated users and anonymous access.

## 2. Configure Vercel

Create/import a Vercel project from this GitHub repository. Framework: **Next.js**, project root: repository root, build command: `npm run build`.

In **Project → Settings → Environment Variables**, add these for Production (and optionally Preview and Development):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL, such as `https://PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key, or legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key |
| `OWNER_EMAIL` | Email address you will use to sign in; this account may manually refresh the source |
| `CRON_SECRET` | A random secret, generated with `openssl rand -hex 32` |

Never add `NEXT_PUBLIC_` to either secret. `.env.local` and `.vercel/` are ignored by Git. Production environment changes require a new deployment; the two public Supabase variables are included at build time.

For local use, copy `.env.example` to `.env.local` and add the same values. Run `npm ci` and `npm run dev`.

## 3. Enable phone sign-in

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to your production Vercel URL, for example `https://YOUR-PROJECT.vercel.app`.
- Add that exact URL to **Redirect URLs**.
- Add `http://localhost:3000` for ordinary local development. If using another port, add that exact origin as well.
- Add only the preview origins you actually use; avoid a broad wildcard across unrelated projects.

Keep email sign-in enabled. Open the tracker, choose **Sign in to sync**, and enter the owner's email. Open the emailed link on the same device. Repeat on your phone using the same email.

Supabase's built-in email sender is intended for development and may only deliver to organization-member emails. For reliable delivery or additional users, configure **Authentication → Email / SMTP settings** with your own email provider. See [Supabase passwordless email documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). No paid email service is configured automatically.

If you marked dragons before signing in, use **My account → Import this device** to add those guest selections to your cloud collection. Existing cloud selections take priority.

## 4. Start and verify updates

1. Sign in with `OWNER_EMAIL`, then press **Refresh rankings**. The initial snapshot should show 2,000+ dragons and the timestamp should update.
2. Vercel registers the schedule in [`vercel.json`](vercel.json) on a production deployment. `0 0 * * *` means daily during **8:00–8:59 AM Asia/Manila** on Hobby. Check **Project → Cron Jobs** to confirm it is present.
3. Cron calls `/api/sync` with `Authorization: Bearer CRON_SECRET`. Calls without the correct credential return 401. Never put that secret in the URL.
4. Manual refresh is owner-only and limited to once an hour. Repeated requests return a clear “already checked” message. Failures keep the previous rankings.
5. New ranking snapshots are only saved if the dragon data changes. The app keeps the last 30 changed snapshots and compares each current rank to the previous one. History begins with your first successful cloud refresh; the app does not invent past ranks.
6. The open screen checks for new saved data every minute and when you return to it. The scheduled job runs on Vercel even if your phone and computer are closed. Local development does not run cron automatically.

To change the daily time, edit the schedule in `vercel.json` using UTC, then push to GitHub. Philippines time is UTC+8 year-round. Hourly Vercel cron requires a plan that supports it; the current daily setup is intended for Hobby.

## 5. Publish source changes

With GitHub CLI installed and signed in:

```sh
git add .
git commit -m "Build Dragon Roster tracker"
gh repo create dragon-roster --public --source=. --remote=origin --push
```

If the remote already exists, use `git push origin main` instead of creating another repository. Connect it in **Vercel → Project → Settings → Git**. Once connected, pushes to `main` deploy automatically. An optional GitHub Actions build-and-test template is saved at `scripts/github-actions-check.yml`. Enable it by copying it to `.github/workflows/check.yml` through GitHub's web editor or using credentials with the `workflow` scope. It is not required for Vercel deployments or daily ranking updates.

For CLI deployment:

```sh
npx vercel link
npx vercel --prod
```

## Everyday use

- **Owned:** dragons you already have.
- **Newly acquired:** dragons recently added to your game; they also appear under Owned. This label remains until you change it.
- **Can summon:** dragons you have enough orbs to summon. This is your manual label, not a claim calculated from your game account.
- **My collection:** all three lists, using the source's global rank numbers.
- Use **General / Damage / Tank / Support / Arena** to rank your collection by role.
- An upward arrow means a better position than the previous snapshot. No earlier snapshot is shown as a dash, not a fabricated change.
- Tap a dragon's name for all five scores, history and source notes.
- To stop tracking a dragon, select **＋ Track dragon** from its status menu.
- Use **My account → Export** for a backup. **Import** merges a backup and keeps existing choices.
- Open the production URL on your phone. Safari: **Share → Add to Home Screen**. Chrome: **Add to Home screen / Install app**. Internet is required; this app does not claim offline cloud synchronization.

## Troubleshooting

**“Cloud setup is pending.”** Add the three Supabase environment values and redeploy.

**Sign-in email does not arrive.** Check Spam, Supabase Auth logs, the organization's email-sender restrictions, and your SMTP configuration. Do not repeatedly request links; the provider has rate limits.

**Sign-in link opens localhost or the wrong site.** Correct Supabase's Site URL and Redirect URLs, then request a new link.

**Collection cannot load or save.** Check that the SQL migration ran successfully, that the project is active, and that the browser is online. The app blocks collection edits after a failed cloud load to avoid overwriting unknown data.

**Rankings are stale.** Check the displayed timestamp, Vercel cron logs, environment variables, and whether Supabase is paused. The Ditlep endpoint is unofficial. If it changes, update `lib/ditlep.ts` and run the tests. Incomplete or unexpectedly shrunken datasets are deliberately rejected.

**No rank arrows yet.** Wait until there are two different saved snapshots. An unchanged daily check updates the “last checked” timestamp but does not create artificial movement.

**Backup imported but some dragons are missing.** A dragon removed from Ditlep will not appear in the current ranking list, but its saved status remains in your export. Imported IDs are preserved.
