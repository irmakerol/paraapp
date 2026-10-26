# Phased plan (web first)

Each phase ends with lint, type-check, unit, database and E2E tests green, a summary, the list of
manual steps for the club, and a stop for approval.

## Phase 0 – Foundation ✅

Monorepo, Next.js app (TR/EN, layout, dark mode, branding), Supabase schema + RLS + pgTAP tests,
auth (email/password, magic link, Google behind a flag, reset, sign out everywhere), age gate 14+
with guardian consent, privacy notice + terms + granular consents, profile with per-field privacy and
encrypted licence number, data export, account deletion, data-subject requests, retention settings,
audit log, docs, CI.

## Phase 1 – Content & community ✅ (this PR)

News (draft/scheduled/published, members-only, pinned, comments, likes), tips knowledge base
(categories, difficulty, suggestions → review, click-to-load YouTube/Vimeo embeds, bookmarks), gear
market (all fields, up to 8 photos, filters + full-text search, lifecycle + 60-day expiry with reminder,
safety notice, reports; minors cannot post), 1-to-1 chat with images/location/read receipts/mute and
real "delete for everyone", reports and blocks, bans, web push (per-topic, news needs marketing consent),
admin area (news CMS, tips review, reports queue with audited chat view, users/roles/member
verification/bans, data-subject request queue), demo seed data.

Minors: adults cannot start a chat with a minor at all for now; a minor may contact an adult (e.g. a
seller). When follows arrive in Phase 2, adults a minor follows will be allowed.

## Phase 2 – Flights & sites

IGC/GPX import (batch), manual entry, logbook (virtualised), stats and records, 2D map with
vario-coloured track + altitude chart with scrubbing, IGC/GPX/KML/CSV export, equipment + check/repack
reminders, sites database + nearest-site matching (PostGIS), share image/link, follows + compare stats.
Public tracks hide the first/last 500 m.

## Phase 3 – Safety & extras

Incident reports (named / community-anonymous / fully anonymous, encrypted injury data, safety-officer
workflow, safety lessons, stats), weather + flyability per site (Open-Meteo, cached), airspace overlay
(OpenAIP), events + RSVP + calendar file, carpool/retrieve board, group chats, SOS screen.

## Phase 4 – Web polish & launch

Performance, accessibility audit, offline (service worker), lawyer-reviewed legal texts, hosting
decision, `app.flyanatolia.com`, production SMTP, public beta.

## Phase 5 – Native apps

Live flight recording (background GPS, barometer, audio vario), auto takeoff/landing detection,
live-tracking link, "who's flying now", Sign in with Apple, native push, store listings and privacy
labels, TestFlight / Play internal testing. Apple Developer ($99/year) and Google Play ($25 once) are
needed here, not before.
