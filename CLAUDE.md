# CLAUDE.md – ParaApp

Paragliding community web app for **Fly Anatolia Havacılık Kulübü** (a dernek in İstanbul).
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
packages/core     Pure TS shared logic: APP_CONFIG, age gate, privacy, units, roles, zod schemas
supabase/         config.toml, migrations, seed.sql (generated), email templates, pgTAP tests
scripts/          db-test.sh (+ shim for plain Postgres), gen-legal-seed.mjs
docs/             ARCHITECTURE, PLAN, DATA_INVENTORY, COSTS, BREACH_RUNBOOK, legal/ drafts
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
- Push goes through `sendPush()` (`lib/push.ts`): it checks topic settings and, for club news, marketing consent.
- Third-party embeds are click-to-load (`components/video-embed.tsx`). No third-party request before the user acts.
- In render, use `currentTime()` from `lib/format.ts` instead of `Date.now()` (the React purity lint rule).
- Maps are third-party requests too: wrap them in `MapGate` (`components/map-gate.tsx`), style URL in `lib/map.ts`.
- Imported flights are analysed on the server and written with the service role (`lib/flight-import.ts`);
  users can only insert manual flights. Other people only ever get `flights.public_track` (first/last
  500 m removed); `flight_tracks` and the `flight-files` bucket are owner-only.
- Storage files are not removed by DB cascades: anything new a user uploads must be added to
  `lib/account-files.ts` (account deletion) and `/api/account/export`.
- `packages/core` lint is `typescript-eslint` strict (no `!`): use `at()` from `tracks/at.ts` for known-good indices.

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
