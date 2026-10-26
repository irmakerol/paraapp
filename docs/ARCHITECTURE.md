# Architecture

Status: approved 2026-10-26 (web first). Updated at the end of each phase.

## 1. Overview

```
 Browser (desktop + mobile)
 ┌──────────────────────────────────────────────────────────┐
 │ Next.js 16 app (apps/web)                                 │
 │  public pages (SSR, indexable): home, news, tips, sites…   │
 │  pilot area: onboarding, account, logbook, chat, market   │
 │  /admin (Phase 1): CMS, moderation, users, DSR queue      │
 │  server actions + route handlers (auth callback, export)  │
 └───────────────┬──────────────────────────────────────────┘
                 │ @supabase/ssr (cookies) · supabase-js
 ┌───────────────▼──────────────────────────────────────────┐
 │ Supabase (local via Docker now; EU Frankfurt when hosted) │
 │  Postgres + PostGIS + RLS (deny by default)               │
 │  Auth: email/password, magic link, Google                 │
 │  Storage: avatars (private, signed URLs) …                │
 │  Realtime (chat, Phase 1) · pg_cron (retention jobs)      │
 └──────────────────────────────────────────────────────────┘
   Later: Open-Meteo (weather), OpenAIP (airspace), Paragliding Earth (sites), OpenFreeMap tiles
```

One web app serves guests, pilots and admins. Admin is a role-gated section of the same app.

## 2. Repository

pnpm workspaces: `apps/web`, `packages/core`, plus `supabase/`, `scripts/`, `docs/`. See `CLAUDE.md`.

`packages/core` has no UI and no I/O, so the same code (validation, age rules, privacy rules,
later IGC/GPX parsing and flight stats) runs in the browser, on the server and in a future native app.

## 3. Web app

| Concern      | Choice                                                                              | Why                                                               |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Framework    | Next.js 16 App Router, React 19, TypeScript strict                                  | Server rendering for SEO; server actions keep secrets server-side |
| i18n         | next-intl, `/tr` and `/en` prefixes, TR default, EN fallback per key                | Indexable per language, hreflang alternates                       |
| Auth/session | @supabase/ssr cookies, refreshed in `src/proxy.ts`                                  | Works with server components and actions                          |
| Styling      | Tailwind v4 with CSS-variable tokens from the club logo; dark mode via next-themes  |                                                                   |
| Forms        | Server actions + `useActionState`, zod schemas from `packages/core`                 | Same validation everywhere, works without JS for most forms       |
| Markdown     | react-markdown + remark-gfm (no raw HTML; no remote images in user content)         | Legal texts, news, tips                                           |
| Realtime     | Supabase Realtime `postgres_changes` on `messages` and `chat_members` (RLS applies) | Live chat and read receipts without our own socket server         |
| Push         | Web Push with VAPID (`web-push` npm package), service worker `public/sw.js`         | Free, no third-party push service account needed                  |
| Tests        | Vitest (unit), Playwright (E2E), pgTAP (database)                                   |                                                                   |

| Maps | MapLibre GL JS 5 + OpenFreeMap vector tiles (no key), loaded only after a click (`MapGate`) | Free; no third-party request until the user asks for the map |
| Lists/charts | TanStack Virtual for the logbook; the altitude chart is a small SVG that is also the slider | Thousands of flights stay fast; no chart library needed |

| Weather | Open-Meteo, fetched on the server, cached per site for 1 hour in `weather_forecasts` | Free, no key; users' browsers never call it |
| Airspace | OpenAIP raster tiles as an optional layer on the click-to-load maps (`NEXT_PUBLIC_OPENAIP_API_KEY`) | Free key; off when no key is set |

Planned (later phases): DEM hillshade, offline caching in the service worker for logbook/tips/sites.

**Flights.** Track files are parsed and analysed **on the server** (`lib/flight-import.ts` with the
pure functions in `packages/core/src/tracks`): clean fixes, detect takeoff/landing (ground speed ≥ 4 m/s
for 30 s), compute stats, match the nearest site within 2 km (`nearest_site()`, PostGIS), downsample to
≤ 2,000 points. The flight row is then written with the service role, so users cannot fake imported
stats (they can only insert `source = 'manual'` flights themselves). Three copies exist:
the original file in the private `flight-files` bucket (owner only), the full simplified track in
`flight_tracks` (owner only, with exact takeoff/landing), and `flights.public_track` with everything
within 500 m of the start and end removed, which is all anyone else (and the share image) ever gets.
Minors' flights are forced to private by a trigger.

**Scheduled work.** Database jobs (ad expiry, purges) run in pg_cron. Push notifications need the app's
VAPID key, so they are sent by `POST /api/cron/notify` (header `Authorization: Bearer $CRON_SECRET`):
scheduled club news, ad-expiry reminders and equipment check/repack reminders (created daily by
`private.process_equipment_reminders()` 14 days before the due date). Call it every 5–15 minutes from any free scheduler
(pg_cron + pg_net, Cloudflare Cron Triggers, or a GitHub Actions schedule). Publishing news "now" from
the admin area sends its push immediately, so locally the cron call is only needed for scheduled news.

## 4. Data and security model

- **Roles:** `user_roles(user_id, role)`; guest = not signed in. Helpers `private.has_role()`,
  `private.is_admin()`, `private.is_member_level()` are used inside RLS policies.
- **RLS on every table** (a test fails if one is missing). Writable columns are limited with column grants
  (e.g. users cannot change their own `status` or `age_group`).
- **Profiles:** `profiles` (owner/admin only) + `profile_private` (owner only: birth date, encrypted
  licence number). Others read `profile_cards`, a view that applies per-field privacy
  (public / members / private) for the current viewer; guests only see adults who consented to a public profile.
- **Consents:** append-only `consents` (type, granted, text version, method, time); `current_consents`
  view gives the latest state. Withdrawing is one click and recorded the same way.
- **Legal texts:** versioned `legal_documents` per locale. `pending_legal_kinds()` re-prompts after a
  material change. The privacy notice (aydınlatma) is acknowledged separately from explicit consent (açık rıza).
- **Age gate:** sign-up sends the birth date; a trigger enforces 14+ in the database. Google users
  complete the age step after first sign-in. 14–17: `pending_guardian` until a guardian confirms through
  a one-time emailed link (token created only with the service role, stored hashed, 7-day expiry).
- **Deletion:** `request_account_deletion()` anonymises the profile, removes roles and private data,
  blocks sign-in and ends all sessions immediately; a daily job purges the auth user after 30 days,
  which cascades to all user data. Files (avatar, ad photos, flight files, chat photos the user sent)
  are removed through the Storage API when deletion is requested (`lib/account-files.ts`).
- **Data-subject requests:** `data_requests` with a due date of min(30 days, one month); users file
  in-app, admins log email/post requests in the admin area.
- **Audit log:** role changes, guardian confirmations, deletions; later every admin/safety-officer read
  of sensitive data. Readable by admins only, writable only through definer functions.
- **Encryption:** sensitive columns are encrypted in the app with AES-256-GCM (Supabase's pgsodium column
  encryption is deprecated). The key is an environment secret, never in the database.
- **Storage:** private buckets + signed URLs for avatars and chat photos, so privacy also applies to the
  file. Public buckets only for content that is public anyway (news covers, ad photos). Uploads go to a
  folder named after the user (or chat), enforced by storage policies.
- **Community (Phase 1):** `news`/`news_comments`/`news_likes`, `tips`/`tip_bookmarks`, `ads`/`ad_photos`,
  `chats`/`chat_members`/`messages`, `reports`, `blocks`, `push_subscriptions`, `notifications`.
  Moderators (`moderator` or `admin`) hide/remove content and ban (`ban_user()`, audited, admins cannot be
  banned). Moderators cannot browse chats; `reported_chat_messages()` opens a chat only for a chat/message
  report and writes an audit entry. "Delete for everyone" strips the message content in a trigger; a copy
  is kept in `private.deleted_message_content` for 30 days for moderation, then purged.
- **Minors in the community:** cannot post ads (RLS); adults can start a chat with a minor only if the
  minor follows them (`start_direct_chat()`); messages are rate-limited (30/minute) for everyone.
- **Flying (Phase 2):** `sites` (everyone reads, moderators edit), `flights` (visibility public /
  members / private via RLS), `flight_tracks` (owner only), `equipment` (owner only), `follows` (only the
  two people involved can see a follow; counts via `follow_counts()`). `pilot_stats()` runs as the
  caller, so other people's stats only count flights the viewer may see.
- **Safety (Phase 3):** `incident_reports` are visible only to `safety_officer` (not admins) and to the
  reporter for named / community-anonymous reports. Fully anonymous reports are inserted by the server
  with the service role, so no user id reaches the database. Injury details live encrypted
  (`INCIDENT_ENCRYPTION_KEY`) in `incident_injuries`, a table with no policies, readable only through
  `read_incident_injury()` (audited); `log_incident_view()` audits every report view and a trigger audits
  status changes. `incident_stats()` returns counts only. `safety_lessons` are not linked to reports.
- **Events, rides, groups (Phase 3):** `events` (organisers = instructors and admins) and `event_rsvps`
  (capacity and deadline checked by a trigger; public counts via `event_counts()`). `rides` and group chats
  (`create_group_chat()`, `add_group_member()`, `remove_group_member()`, `rename_group_chat()`) are adults
  only. `weather_forecasts` is a per-site cache written only by the server.
- **Retention:** `retention_policies` table drives pg_cron jobs.

## 5. Auth flows

Email + password (confirmation required), magic link (existing users only), Google OAuth (behind a
flag), password reset, sign out here / everywhere. Email links go to `/auth/confirm` (token hash),
OAuth to `/auth/callback` (PKCE). Redirect targets are restricted to our own origin.

## 6. Deployment (decided later)

Localhost for now. Options at launch, all keeping data in the EU:
hosted Supabase (Frankfurt) + Next.js on Cloudflare Workers (OpenNext) or a small EU VPS running both
the app and self-hosted Supabase. See `docs/COSTS.md`. The club already owns `flyanatolia.com`, so a
subdomain (e.g. `app.flyanatolia.com`) costs nothing.

## 7. Path to native

Phase 5. Live flight recording needs background GPS, the barometer and reliable push, which browsers
cannot provide. Options: wrap this app with Capacitor and add native plugins, or build a small
React Native recorder sharing `packages/core`. Sign in with Apple is added then.
