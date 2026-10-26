# Costs

Rule: free/open-source first; anything paid must be justified here. Prices are list prices seen
in 2025–2026 and must be re-checked before signing up. Today the app runs on localhost: **€0**.

## Fixed / one-off

| Item                          | Cost                                                          | When             |
| ----------------------------- | ------------------------------------------------------------- | ---------------- |
| Domain                        | €0 – the club owns flyanatolia.com; use `app.flyanatolia.com` | Phase 4          |
| Apple Developer Program       | $99 / year                                                    | Phase 5 (native) |
| Google Play developer account | $25 once                                                      | Phase 5 (native) |

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
