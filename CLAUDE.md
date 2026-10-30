# CLAUDE.md – ParaApp

Paragliding community web app for **Fly Anatolia Hava Sporları Kulübü** (a dernek in İstanbul).
Web first; native iOS/Android come later (Phase 5). The decisions that matter are recorded below
and in `docs/`.

## Working agreement

- Work phase by phase (`docs/PLAN.md`). At the end of each phase run
  `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`, summarise, list manual steps for the
  owner, then stop for approval.
- Free/open-source first. Any paid service needs its free-tier limits written in `docs/COSTS.md`.
- Code, comments and commit messages in English. **Every user-facing string goes through i18n**
  (`apps/web/src/messages/{tr,en}.json`; Turkish is the default, English the fallback). Keep both
  files in sync.
- Never commit secrets. `.env.example` files list every variable.
- Keep this file updated when a convention or decision changes.

## Layout

```
apps/web          Next.js 16 (App Router) + next-intl + Tailwind v4 + Supabase SSR
apps/mobile       Expo (React Native) phone app: flight recorder + upload. npm, not in the pnpm workspace
packages/core     Pure TS shared logic: APP_CONFIG, age gate, privacy, units, roles, zod schemas
supabase/         config.toml, migrations, seed.sql (generated), email templates, pgTAP tests
scripts/          db-test.sh (+ shim for plain Postgres), gen-legal-seed.mjs
docs/             ARCHITECTURE, PLAN, DATA_INVENTORY, COSTS, LAUNCH, BREACH_RUNBOOK, legal/ drafts
deploy/           compose stack (web, Caddy, scheduler, backups) and the deployment guide
```

## Commands

| What                          | Command                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Install                       | `pnpm install`                                                                          |
| Start local Supabase (Docker) | `pnpm db:start` (stop: `pnpm db:stop`)                                                  |
| Reset DB + seed               | `pnpm db:reset`                                                                         |
| Web dev server                | `pnpm dev` → http://localhost:3000                                                      |
| Lint / types / unit tests     | `pnpm lint`, `pnpm typecheck`, `pnpm test`                                              |
| RLS / DB tests                | `npx supabase test db` (Docker) or `pnpm test:db` (plain Postgres 16 + PostGIS + pgTAP) |
| E2E (needs a build)           | `pnpm --filter @paraapp/web build && pnpm test:e2e`                                     |
| Regenerate DB types           | `pnpm db:types` (overwrites the hand-written `database.types.ts`)                       |
| Rebuild legal seed            | `node scripts/gen-legal-seed.mjs`                                                       |

## Conventions

- **Names** live in `packages/core/src/config.ts` (`APP_CONFIG`). The app name is the placeholder `ParaApp`.
- **Security lives in the database.** Every table has RLS, no permissive defaults, explicit policies.
  Helpers live in the `private` schema with `search_path = ''`. Restrict writable columns with
  column grants. Every new table needs a pgTAP test proving other users cannot read or write it.
- Functions in `private` that must not be callable by users: `revoke execute ... from public, anon, authenticated`
  (Postgres grants EXECUTE to PUBLIC by default).
- **Migrations** are append-only: never edit one that has been pushed; add a new file.
- Lists that exist in both SQL and TS (roles, consent types, privacy fields, legal kinds) must match;
  the TS side is in `packages/core`.
- **Server actions** return `ActionState` (`apps/web/src/lib/action-state.ts`) with i18n keys, never raw text.
- The service-role client (`lib/supabase/admin.ts`) is only for things a user must not do with their own
  session (e.g. creating guardian tokens, deleting an under-age account).
- Sensitive columns (licence number now, injury details later) are encrypted in the app
  (`lib/crypto.ts`, AES-256-GCM, key in `LICENCE_ENCRYPTION_KEY`).
- Images are resized and re-encoded in the browser before upload, which strips EXIF/GPS.
- Accessibility: a label on every input, 44px minimum touch targets, visible focus, dark mode via `next-themes`.
- Next.js 16: request interception is `src/proxy.ts` (formerly middleware); `params`/`searchParams`/`cookies()` are async.
- `'use server'` files may only export async functions; put shared sync helpers in `src/lib` (e.g. `lib/tips.ts`, `lib/ads.ts`).
- Error keys in `ActionState` live under `auth.errors` unless they contain a dot (then they are full keys, e.g. `market.adultsOnly`).
- Names of other people always come from the `profile_cards` view (`lib/people.ts`), never from `profiles`.
- Admin pages call `requireStaff(locale, area)` (`lib/staff.ts`); RLS enforces the same roles.
  `super_admin` (the club owner, `ADMIN_EMAIL` on the test server) always also holds `admin` and is
  the only one who can grant or revoke `admin`/`super_admin`. `guide` (rehber) counts as a member.
- Every new account gets `member` (shown as "Misafir üye" / guest member), so members-only means
  signed in. `pilot` means licensed, `student_pilot` is in training (2026-10-30). Ground School
  (`tips`) is written by instructors, moderators and the super admin; sites by the super admin only.
- Push goes through `sendPush()` (`lib/push.ts`): it checks topic settings and, for club news, marketing consent.
- Third-party embeds are click-to-load (`components/video-embed.tsx`). No third-party request before the user acts.
- In render, use `currentTime()` from `lib/format.ts` instead of `Date.now()` (the React purity lint rule).
- Maps are third-party requests too: wrap them in `MapGate` (`components/map-gate.tsx`), style URL in `lib/map.ts`.
- Imported flights are analysed on the server and written with the service role (`lib/flight-import.ts`);
  users can only insert manual flights. Other people only ever get `flights.public_track` (first/last
  500 m removed); `flight_tracks` and the `flight-files` bucket are owner-only.
- Storage files are not removed by DB cascades: anything new a user uploads must be added to
  `lib/account-files.ts` (account deletion) and `/api/account/export`.
- Incident reports are for `safety_officer` only (admin area `safety`; admins are excluded on purpose).
  Fully anonymous reports are inserted with the service role and no reporter; injury details are
  encrypted with `INCIDENT_ENCRYPTION_KEY` and read only via `read_incident_injury()` (audited).
- The notice board (`notices`, page "Duyurular") replaced the ride board; the gear market stays at
  `/market` but is shown as a prominent section of `/notices`. `rides` is legacy (no UI).
- Notices, rides and group chats are adults only (RLS + definer functions); keep minors out of new
  person-to-person features unless the minor opted in (as with follows for 1-to-1 chats).
- Weather is fetched only on the server (`lib/weather.ts`, cached in `weather_forecasts`); the
  flyability rules live in `packages/core/src/weather.ts`.
- A new third-party host (map tiles, embeds, APIs called from the browser) must be added to the CSP in
  `next.config.ts`. `NEXT_PUBLIC_*` values and the CSP are fixed at build time.
- The service worker (`public/sw.js`) only caches public pages from signed-out requests; personal
  pages must stay out (the proxy marks signed-in responses with `x-paraapp-session`). Bump `VERSION`
  in `sw.js` when its caching rules change.
- Deployment: `Dockerfile` (standalone output) + `deploy/compose.yaml`; steps in `deploy/README.md`.
- `packages/core` lint is `typescript-eslint` strict (no `!`): use `at()` from `tracks/at.ts` for known-good indices.

- Trips (`trips`, `trip_*` tables) are managed by `instructor`, `trip_organiser` and `admin` (admin area
  `trips`); a trip's guides (`trip_guides`) see its participants. Registrations are written only through
  definer functions (`register_for_trip` etc.); seats, the waiting list and pilot notifications are
  handled by triggers. Payments are tracked by hand (`payment_status`), the app takes no money.
- Student pilots record `profiles.training_level`: only levels above their current one in form order
  P2 < … < P5 < T1 < T2 < T3 (`trainingLevelOptions()` in core = `private.training_level_ok` in SQL,
  checked by a constraint; reaching the target clears it). Admins set it with `admin_set_training_level`.
- Pilot levels offered in the UI are `PILOT_LEVEL_CHOICES` (P2–P5, T1–T3, Instructor); older enum values
  (student, p1, tandem) stay valid. For requirements, T1–T3 rank like P5 (`pilot_level_rank`).
- Profile totals (`total_flight_hours`, `total_flights`) grow only through `add_flights_to_totals()`,
  which counts each flight once (`flights.counted_in_totals`); the importer and the tracker ask first.
- XC scores (`flights.xc_type`, `xc_distance_m`, `xc_points`) are set only by the server
  (`scoreFlight()` on the stored track at import, or lazily on the owner's flight page). Store numbers
  only; the scored route can include takeoff and landing, so draw it for the owner only.
- The 3D replay uses Terrain Tiles on AWS Open Data (`TERRAIN_TILES` in `lib/map.ts`, in the CSP),
  requested only when the user turns 3D on.
- The phone app mirrors the whole website except admin (Irmak, 2026-10-30): tabs Home, Fly, Flights,
  Messages, Profile; every club section is a tile on Home. Server-only steps use Bearer routes under
  `/api/mobile/*` that share code with the website (`lib/incidents.ts`, `lib/send-message.ts`).
- Phone app (`apps/mobile`, docs/MOBILE.md): its strings live in `src/messages.ts` (TR default, EN
  fallback, typed so both stay in sync). It talks to the website with a Bearer token
  (`lib/supabase/bearer.ts`, `/api/mobile/*`). Built and uploaded to TestFlight by
  `.github/workflows/ios.yml`; the hosted test server is set up by `.github/workflows/cloud.yml`.
  Public repo = public Actions logs: mask every key (`::add-mask::`).
- Sample data for testing lives in `supabase/samples/sample_data.sql` (kept out of `seeds/` so `db reset` and the RLS tests stay clean; the test server loads it): names/titles end in "(Ö)",
  shown as "(S)" on English pages via `sampleLabel()` (`lib/sample.ts`). Seeds must be safe to run
  twice (the test server re-applies them on every deploy).
- Years flying is derived from `profiles.flying_since` (`private.years_flying`); `years_flying` is legacy.

## Decisions (2026-10-26)

- Web first. Next.js because public pages must rank on Google. Native later (Capacitor wrap or a
  dedicated recorder app), decided in Phase 5.
- Live flight recording waits for native; the web logbook imports IGC/GPX.
- Minimum age 14. Ages 14–17 need guardian consent by email link; minors default to private
  everything, no marketplace posting, adults can start chats with a minor only if the minor follows them.
- New flights default to **public** for adults with the first/last 500 m hidden; minors default to private.
- Retention: deleted accounts purged 30 days after the request; chats kept until deleted; the rest
  in `retention_policies`.
- The app is free of charge. Keep Supabase (open source, self-hostable later). Develop on localhost for now.
- Locale: browser language if TR/EN, otherwise Turkish.
