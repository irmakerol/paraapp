# Phased plan (web first)

Each phase ends with lint, type-check, unit, database and E2E tests green, a summary, the list of
manual steps for the club, and a stop for approval.

## Phase 0 – Foundation ✅

Monorepo, Next.js app (TR/EN, layout, dark mode, branding), Supabase schema + RLS + pgTAP tests,
auth (email/password, magic link, Google behind a flag, reset, sign out everywhere), age gate 14+
with guardian consent, privacy notice + terms + granular consents, profile with per-field privacy and
encrypted licence number, data export, account deletion, data-subject requests, retention settings,
audit log, docs, CI.

## Phase 1 – Content & community ✅

News (draft/scheduled/published, members-only, pinned, comments, likes), tips knowledge base
(categories, difficulty, suggestions → review, click-to-load YouTube/Vimeo embeds, bookmarks), gear
market (all fields, up to 8 photos, filters + full-text search, lifecycle + 60-day expiry with reminder,
safety notice, reports; minors cannot post), 1-to-1 chat with images/location/read receipts/mute and
real "delete for everyone", reports and blocks, bans, web push (per-topic, news needs marketing consent),
admin area (news CMS, tips review, reports queue with audited chat view, users/roles/member
verification/bans, data-subject request queue), demo seed data.

Minors: adults cannot start a chat with a minor at all for now; a minor may contact an adult (e.g. a
seller). When follows arrive in Phase 2, adults a minor follows will be allowed.

## Phase 2 – Flights & sites ✅

IGC/GPX import (batch, analysed on the server), manual entry, logbook (virtualised), stats and records,
2D map with vario-coloured track + altitude chart with scrubbing (click-to-load map), IGC/GPX/KML/CSV
export and a CSV of the whole logbook, equipment with check/repack reminders (in-app + push), sites
database + nearest-site matching (PostGIS) + admin editing, share image and link, pilot pages, follows
and compare stats. Public and members-only tracks hide the first/last 500 m; the full track is
owner-only. Adults may now start a chat with a minor who follows them.

Not done here (later): hillshade/terrain on the map (needs a DEM tile source), flight comments/likes,
a pilots directory and search, offline logbook.

## Phase 3 – Safety & extras ✅ (this PR)

Incident reports (named / community-anonymous / fully anonymous, encrypted injury data, safety-officer
workflow, safety lessons, stats), weather + flyability per site (Open-Meteo, cached), airspace overlay
(OpenAIP), events + RSVP + calendar file, carpool/retrieve board, group chats, SOS screen.

As built:

- **Incidents** go only to users with the `safety_officer` role (admins do not see them). Fully
  anonymous reports are written by the server with the service role, so no user id is stored. Injury
  details are encrypted in the app (`INCIDENT_ENCRYPTION_KEY`), need explicit consent in the form, sit
  in a table with no policies, and every read and every report view is audited. One year after
  closing, the reporter, contact flag and injury details are removed by a cron job.
- **Safety lessons** are written by safety officers and are deliberately not linked to reports.
  Public stats are counts by year, type and severity only.
- **Weather** is fetched on the server from Open-Meteo and cached per site for an hour; the flyability
  rating (wind strength, gusts, direction vs. the site's wind directions, rain, CAPE) is in
  `packages/core/src/weather.ts`. The sites list only reads the cache.
- **Airspace** is an optional OpenAIP raster layer on the click-to-load maps, shown only when
  `NEXT_PUBLIC_OPENAIP_API_KEY` is set.
- **Events** are created by instructors and admins; RSVP with capacity and deadline (checked in the
  database), `.ics` calendar file, attendee list for organisers.
- **Rides** and **group chats** are adults only (safeguarding). Ride posts are deleted 30 days after
  the ride date.
- **SOS** works without an account: emergency numbers, the browser's position in decimal and DMS, copy
  / SMS / map links. Nothing is sent to our server.

Not done here (later): weather alerts by push, airspace as vector data (NOTAMs, altitude limits),
incident attachments (photos), event reminders by push, recurring events.

## Phase 4 – Web polish & launch

Performance, accessibility audit, offline (service worker), lawyer-reviewed legal texts, hosting
decision, `app.flyanatolia.com`, production SMTP, public beta.

## Phase 5 – Native apps

Live flight recording (background GPS, barometer, audio vario), auto takeoff/landing detection,
live-tracking link, "who's flying now", Sign in with Apple, native push, store listings and privacy
labels, TestFlight / Play internal testing. Apple Developer ($99/year) and Google Play ($25 once) are
needed here, not before.
