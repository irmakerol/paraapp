# Costs

Rule: free/open-source first; anything paid must be justified here. Prices are list prices seen
in 2025–2026 and must be re-checked before signing up. Today the app runs on localhost: **€0**.

## Fixed / one-off

| Item                          | Cost                                                          | When             |
| ----------------------------- | ------------------------------------------------------------- | ---------------- |
| Domain                        | €0 – the club owns flyanatolia.com; use `app.flyanatolia.com` | Phase 4          |
| Apple Developer Program       | $99 / year                                                    | Phase 5 (native) |
| Google Play developer account | $25 once                                                      | Phase 5 (native) |

## Beta launch setup (Phase 4)

| Part                           | Choice                                                  | Cost            | Free-tier limits that matter                                                                                   |
| ------------------------------ | ------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| Database, auth, storage        | Supabase free, Frankfurt                                | €0              | 500 MB database, 1 GB files, 5 GB egress/month, 50k monthly active users; pauses after 7 idle days; no backups |
| Web server                     | Owner's choice (see below)                              | €0 to ~€5/month |                                                                                                                |
| HTTPS certificate              | Let's Encrypt via Caddy                                 | €0              | Renewed automatically                                                                                          |
| Email (sign-up, guardian mail) | Brevo free                                              | €0              | 300 emails/day                                                                                                 |
| Backups                        | Nightly encrypted `pg_dump` on the web server (14 days) | €0              | Files in Storage need a separate copy (see `deploy/README.md`)                                                 |
| Uptime monitoring              | UptimeRobot free                                        | €0              | 50 monitors, 5-minute checks                                                                                   |

Web server options (all run the same Docker image):

| Option                               | Cost        | Notes                                                                                                                                                                               |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle Cloud Always Free (Frankfurt) | €0          | Ampere VM, up to 4 cores / 24 GB free. A card is needed to sign up. Oracle may reclaim VMs that stay idle for 7 days.                                                               |
| Small EU VPS (e.g. Hetzner, Germany) | ~€4–5/month | Simplest and most predictable.                                                                                                                                                      |
| Cloudflare Workers                   | $5/month    | The app is 3.9 MB compressed (measured); the free plan allows 3 MB, the paid plan 10 MB. No server to maintain.                                                                     |
| Vercel Hobby                         | —           | Not for launch: Hobby is for personal, non-commercial use. Used **only as the temporary test server** for the TestFlight build (Oct 2026); move to the Oracle VM before real users. |

## Monthly estimate by number of registered users

Assumptions: 20% monthly active; per user ≈ 1 MB of database rows (profile, messages, ads, flights
as simplified tracks), ≈ 5 MB of files (photos and raw IGC files), ≈ 30 MB/month of downloads per
active user; weather is cached per site, not per user.

|                      | 500 users                                                                                                                                                                                                  | 5,000 users                                                             | 50,000 users                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Database             | ~0.5 GB                                                                                                                                                                                                    | ~5 GB                                                                   | ~50 GB                                                     |
| File storage         | ~2.5 GB                                                                                                                                                                                                    | ~25 GB                                                                  | ~250 GB                                                    |
| Egress / month       | ~3 GB                                                                                                                                                                                                      | ~30 GB                                                                  | ~300 GB                                                    |
| **Supabase**         | Free tier is _almost_ enough: 500 MB DB, 1 GB storage, 5 GB egress. **Storage hits the limit first**, and free projects pause after 7 days without traffic and have no backups. Realistically Pro: **$25** | Pro $25 (8 GB DB, 100 GB storage, 250 GB egress included) → **~$25–35** | Pro + extra storage/compute/egress → **~$100–200**         |
| Web hosting          | Cloudflare Workers free tier (100k requests/day) or €4–6 EU VPS                                                                                                                                            | Workers paid $5 or VPS €5–10                                            | Workers paid ~$5–20 or VPS €20–40                          |
| Email                | Free tier (e.g. Brevo 300/day) **€0**                                                                                                                                                                      | Free tier likely enough **€0**                                          | Paid plan ~€10–25                                          |
| Weather (Open-Meteo) | Free for non-commercial use, <10k calls/day; cached per site **€0**                                                                                                                                        | **€0**                                                                  | **€0** (confirm the club's use counts as non-commercial)   |
| Airspace (OpenAIP)   | Free API key, free for non-commercial use; tiles load only on "Show map" **€0**                                                                                                                            | **€0**                                                                  | **€0** (check OpenAIP's fair-use limits)                   |
| Maps (OpenFreeMap)   | **€0**                                                                                                                                                                                                     | **€0**                                                                  | **€0** (consider self-hosting tiles if usage is very high) |
| Web push (VAPID)     | **€0** – browsers deliver it; no push service account                                                                                                                                                      | **€0**                                                                  | **€0**                                                     |
| Realtime chat        | Included in Supabase (free: 200 concurrent connections, 2M messages/month) **€0**                                                                                                                          | Included in Pro (500 concurrent) **€0**                                 | May need more connections (~$10 per 1,000)                 |
| Errors (Sentry)      | Free tier **€0**                                                                                                                                                                                           | **€0**                                                                  | Possibly paid (~$26)                                       |
| **Total / month**    | **€0 on free tiers** (with pausing and no backups) or **~$25** for a proper launch                                                                                                                         | **~$30–45**                                                             | **~$130–270**                                              |

### Which limit we hit first

1. **Supabase file storage (1 GB free)** – photos and raw IGC files (typically 0.2–3 MB each, max 8 MB;
   a pilot with 200 flights ≈ 200 MB). Mitigation: aggressive client-side
   image resizing (done), keep only simplified tracks in the DB, and move raw files to Cloudflare R2
   (10 GB free, no egress fees) if needed.
2. **Supabase free-tier pausing / no backups** – not acceptable for real users; budget Pro at launch.
3. **Database size (500 MB free)** – chat messages and flights grow it.

### Cheapest serious alternative

Self-host the whole stack (Next.js + Supabase's open-source Docker setup) on one EU VPS
(~€5–10/month at 500–5,000 users). Trade-off: the club must handle updates and backups itself.

## Phone app (2026-10-29)

| Service                      | Plan                         | Cost                    | Limits that matter                                                                                                                            |
| ---------------------------- | ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Developer Program      | the club's existing account  | $99/year (already paid) | TestFlight: 100 internal testers (no review), 10,000 external (beta review first); builds expire after 90 days                                |
| GitHub Actions macOS runners | free for public repositories | €0                      | Unlimited minutes for public repos; a build takes ~15–25 min                                                                                  |
| Supabase Cloud (test server) | Free                         | €0                      | As above: pauses after 7 idle days, no backups. Built-in email is rate-limited (a few mails/hour), so testers should use Apple/Google sign-in |
| Vercel Hobby (test server)   | Hobby                        | €0                      | Personal/non-commercial only: temporary, see above                                                                                            |
| Google sign-in               | Google Cloud OAuth client    | €0                      | Free                                                                                                                                          |
