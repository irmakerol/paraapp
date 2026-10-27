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

## Phase 3 – Safety & extras ✅

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

## Phase 4 – Web polish & launch ✅ (this PR; the launch itself needs the owner's steps)

Performance, accessibility audit, offline (service worker), lawyer-reviewed legal texts, hosting
decision, `app.flyanatolia.com`, production SMTP, public beta.

As built:

- **Accessibility:** automated axe (WCAG 2.1 A/AA) checks on 12 public pages in light and dark mode
  run in CI (`e2e/a11y.spec.ts`). Fixed contrast of SOS and delete buttons, the logo link's name,
  footer touch targets, and the header that overflowed on laptops (full menu only from 1536 px).
- **Performance:** Lighthouse mobile (local): performance 87, accessibility, best practices and SEO 100. Maps stay lazy-loaded (the largest chunk); AVIF/WebP images; week-long caching for brand files.
- **Offline:** SOS page always available; public pages visited while signed out are readable offline;
  a localized offline page; nothing personal is cached.
- **Error pages:** localized 404 (also for unknown paths) and error page with retry; a bilingual
  last-resort page if the layout itself fails.
- **SEO:** `robots.txt` (personal areas disallowed) and `sitemap.xml` (public content only; flights and
  pilots left out on purpose).
- **Security:** CSP, HSTS; `/api/health` for uptime checks.
- **Deployment:** Docker image + compose stack (Caddy HTTPS, push scheduler, encrypted nightly
  backups) and a step-by-step guide in `deploy/README.md`; Brevo free SMTP for app and auth emails.
- **Legal drafts** updated for everything built in Phases 1–3 (chat, ads, flights and GPS, incidents
  and health data, events, rides, third-party map/video requests, SOS); ready for the lawyer.
- **Launch checklist:** `docs/LAUNCH.md`.

## Rebrand ✅ (PR #6)

The club's round logo and its name **Fly Anatolia Hava Sporları Kulübü** everywhere (header, icons,
emails, legal texts).

## Phase 5 – Trips & pilot profile (PR #7)

Asked for on 2026-10-27. Web, free.

- **Trips** as their own section, separate from events and news: destination, dates, meeting point,
  day-by-day itinerary, flying sites, guide pilots, maximum/minimum pilots, registration window,
  requirements (minimum level, years flying, flights, required equipment), price, deposit, what's
  included, payment info and cancellation policy, accommodation and transport, cover photo,
  members-only and minors options.
- **Show interest** (non-binding) and **Subscribe** (seat request → pending/accepted/waiting list,
  automatic move-up when a seat frees, pilots can cancel). Payment is recorded by hand.
- **Admin → Trips** for trip organisers (new role), instructors and admins: participants with level,
  experience and contacts, paid status, notes, CSV, notify everyone interested, group chat with the
  group, "announce" as a linked news post.
- **Pilot profile:** level (P2–P5, T1–T3, instructor), wing make and model, weight, flying since,
  bio, photo, total hours and total flights; after importing a flight, the app asks whether to add it
  to the totals (the phone tracker will ask the same).
- Public beta can launch after this phase (`docs/LAUNCH.md`).

## Phase 6 – Flight replay (PR #8)

Asked for on 2026-10-27. Web, free.

- **Replay** on every flight page: play/pause, 10×/25×/50×/100×, the map follows the glider, live
  clock, flight time, altitude, climb and ground speed; drag or use the arrow keys on the chart.
- **3D** over terrain (free Terrain Tiles on AWS Open Data, loaded only when 3D is turned on).
- **Replay together:** other visible flights from the same takeoff on the same day, on the same clock,
  each with its own colour on the map and the altitude chart (others get the trimmed track).
- **XC score** (XContest-style estimate): free distance via 3 turnpoints ×1, flat triangle ×1.2, FAI
  triangle ×1.4, triangles closed within 20 %. Computed by the server at import and stored on the
  flight; the scored route is drawn for the owner only.
- **XContest-ready:** the IGC download gives the owner their original file, with a link to upload it.

## Phase 7 – Phone tracker, Android first

A phone app that records flights like Wingman (feature list from its public store page, see
`/mnt/project-files/paraapp/trips-and-tracking-plan.md`): audio vario (GPS + barometer), altitude,
speed, glide, auto take-off and landing, IGC recording, upload to the logbook with the "add to my
totals?" question, live-tracking link for family and friends, friends flying nearby, airspace alerts.
React Native (Expo) sharing `packages/core`, because the vario needs low-latency sound and sensors
that a web view can't give. Android testers install the app file directly: **free**.

## Phase 8 – Tracker extras and iPhone

Waypoints and routes (.wpt, QR), wind estimate, Bluetooth varios, XContest upload, PureTrack
forwarding, iPhone version (Apple Developer $99/year, needs the club's OK), Google Play listing
($25 once), store privacy labels. Apple Watch later.
