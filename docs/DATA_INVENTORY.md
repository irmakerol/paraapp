# Data inventory (KVKK / GDPR) – draft

Status: **draft for the club's lawyer**, Phase 1. Updated whenever a feature adds personal data.
Controller: Fly Anatolia Hava Sporları Kulübü (dernek), Kordonboyu Mah. Ankara Cd. No:27 D:108,
34862 Kartal / İstanbul · info@flyanatolia.com

Legal bases use KVKK Art. 5/6 and GDPR Art. 6/9. "Contract" = providing the service the user signed up for.

## 1. Personal data (Phase 0)

| Data                                                                             | Where                                     | Purpose                                                | Legal basis                                        | Who can access                                       | Retention                                                                          | Leaves TR?          |
| -------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------- |
| Email, password hash, sign-in provider                                           | `auth.users`                              | Account, sign-in                                       | Contract (KVKK 5/2-c, GDPR 6/1-b)                  | User; system                                         | Until account purge (30 days after deletion request)                               | Yes, EU (hosting)   |
| IP address, user agent, session records                                          | `auth.sessions`, auth logs                | Security, abuse prevention                             | Legitimate interest (5/2-f, 6/1-f)                 | System; admins via platform logs                     | Platform log retention (Supabase)                                                  | Yes, EU             |
| Display name                                                                     | `profiles`                                | Identify the user to others                            | Contract                                           | Everyone signed in; guests if public profile consent | Anonymised at deletion request                                                     | Yes, EU             |
| Full name, photo, country/city, home site, pilot level, years flying, wings, bio | `profiles`, `avatars` bucket              | Community profile                                      | Contract; visibility chosen per field              | Per field: everyone / members / only me              | Removed at deletion request                                                        | Yes, EU             |
| Licence number                                                                   | `profile_private` (AES-256-GCM encrypted) | Optional record for the pilot                          | Contract                                           | Only the user                                        | Removed at deletion request                                                        | Yes, EU (encrypted) |
| Date of birth                                                                    | `profile_private`                         | Minimum age 14, guardian consent for 14–17, turning 18 | Legal obligation / legitimate interest             | Only the user (and DB operators)                     | Removed at deletion request                                                        | Yes, EU             |
| Age group, account status                                                        | `profiles`                                | Apply minors' protections                              | Legal obligation / legitimate interest             | User; admins                                         | Account lifetime                                                                   | Yes, EU             |
| Guardian name, guardian email, confirmation time                                 | `guardian_consents`                       | Parental consent for minors                            | Legal obligation (consent of legal representative) | User (no token); system                              | Account lifetime; unconfirmed requests deleted 30 days after expiry                | Yes, EU             |
| Consent records (type, yes/no, text version, method, time)                       | `consents`                                | Prove and honour consent                               | Legal obligation                                   | User; admins                                         | Account lifetime (+ purge)                                                         | Yes, EU             |
| Legal acceptances                                                                | `legal_acceptances`                       | Prove notice was shown / terms accepted                | Legal obligation                                   | User                                                 | Account lifetime                                                                   | Yes, EU             |
| Data-subject requests (email, type, details, status)                             | `data_requests`                           | Handle rights requests within deadline                 | Legal obligation                                   | User (own); admins                                   | Kept after account purge with user link removed; review period to be set by lawyer | Yes, EU             |
| Audit log (actor, action, target id)                                             | `audit_log`                               | Accountability                                         | Legal obligation / legitimate interest             | Admins                                               | 730 days                                                                           | Yes, EU             |
| Deletion record (user id, dates)                                                 | `account_deletions`                       | Prove deletion                                         | Legal obligation                                   | Admins                                               | To be set by lawyer                                                                | Yes, EU             |
| Language, units                                                                  | `profiles`                                | Preferences                                            | Contract                                           | User                                                 | Account lifetime                                                                   | Yes, EU             |

## 1b. Personal data added in Phase 1

| Data                                                           | Where                                                    | Purpose                                     | Legal basis                                              | Who can access                                                               | Retention                                                                      | Leaves TR?                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Comments and likes on news                                     | `news_comments`, `news_likes`                            | Community discussion                        | Contract                                                 | Everyone who can see the article; moderators (also hidden ones)              | Until deleted by the author or a moderator; account purge                      | Yes, EU                                                                       |
| Tip suggestions, review notes, bookmarks                       | `tips`, `tip_bookmarks`                                  | Knowledge base                              | Contract                                                 | Published tips: everyone; drafts: author + editors; bookmarks: only the user | Tips stay (author link removed at purge); bookmarks until account purge        | Yes, EU                                                                       |
| Ads (gear details, price, city/location text) and photos       | `ads`, `ad_photos`, `ad-photos` bucket                   | Members selling gear                        | Contract                                                 | Everyone (public listings); photos are public files, EXIF stripped           | Expire after 60 days; archived/sold ads deleted after 180 days (`expired_ads`) | Yes, EU                                                                       |
| Chats: members, messages, photos, shared locations, read times | `chats`, `chat_members`, `messages`, `chat-media` bucket | 1-to-1 messaging                            | Contract                                                 | Only the chat members; moderators only for a reported chat (audited)         | Until deleted or account purge (`chat_messages`: null = keep)                  | Yes, EU                                                                       |
| Content of messages deleted "for everyone"                     | `private.deleted_message_content`                        | Handle reports about deleted messages       | Legitimate interest (safety, abuse)                      | Moderators via a report (audited)                                            | 30 days (`deleted_message_content`)                                            | Yes, EU                                                                       |
| Reports (reporter, target, reason, details, resolution)        | `reports`                                                | Moderation                                  | Legitimate interest                                      | Reporter (own); moderators                                                   | To be set by lawyer; reporter link removed at purge                            | Yes, EU                                                                       |
| Blocks                                                         | `blocks`                                                 | Stop unwanted contact                       | Contract                                                 | Only the blocker                                                             | Until removed or account purge                                                 | Yes, EU                                                                       |
| Bans (until date, reason)                                      | `auth.users.banned_until`, `audit_log`                   | Enforce rules                               | Legitimate interest                                      | Moderators/admins                                                            | Ban lasts until the date; audit 730 days                                       | Yes, EU                                                                       |
| Push subscriptions (endpoint, keys, browser user agent)        | `push_subscriptions`                                     | Deliver notifications to the user's devices | Contract; club news: consent (`marketing_notifications`) | Only the user; system                                                        | Until turned off, the browser drops it (410), or account purge                 | Yes, EU; push endpoint is the browser vendor's service (Google/Mozilla/Apple) |
| Notification settings, in-app notifications                    | `profiles.notification_prefs`, `notifications`           | Preferences and reminders                   | Contract                                                 | Only the user                                                                | Account lifetime                                                               | Yes, EU                                                                       |

## 1c. Personal data added in Phase 2

| Data                                                                   | Where                           | Purpose                                                           | Legal basis                              | Who can access                                                                     | Retention                                                                     | Leaves TR? |
| ---------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| Original IGC/GPX files                                                 | `flight-files` bucket (private) | Let the pilot download their file again                           | Contract                                 | Only the pilot                                                                     | Until the flight is deleted; account deletion request (files removed at once) | Yes, EU    |
| Full flight track incl. exact takeoff/landing                          | `flight_tracks`                 | Logbook, map, stats                                               | Contract                                 | Only the pilot                                                                     | Until the flight is deleted or account purge                                  | Yes, EU    |
| Flight summary, stats, notes, trimmed track (first/last 500 m removed) | `flights`                       | Logbook; sharing with the community                               | Contract; visibility chosen by the pilot | Per flight: everyone / club members / only the pilot; minors always only the pilot | Until deleted or account purge                                                | Yes, EU    |
| Equipment (brand, model, dates)                                        | `equipment`                     | Check/repack reminders                                            | Contract                                 | Only the user                                                                      | Until deleted or account purge                                                | Yes, EU    |
| Follows                                                                | `follows`                       | Social features; lets a minor allow chats from adults they follow | Contract                                 | The two people involved; counts are public                                         | Until removed or account purge                                                | Yes, EU    |
| Sites (created by moderators)                                          | `sites`                         | Site guide                                                        | Legitimate interest                      | Everyone; `created_by` only moderators                                             | Until deleted                                                                 | Yes, EU    |

Maps: when a user presses "Show map", the browser loads tiles from **OpenFreeMap** (their IP address
and the visible area reach that service). Nothing is loaded before the click; "always show maps" is
stored only in that browser.

## 1d. Personal data added in Phase 3

| Data                                                               | Where                                                    | Purpose                             | Legal basis                                                                  | Who can access                                                          | Retention                                                                                                                | Leaves TR? |
| ------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Incident report (what happened, site, date, equipment, conditions) | `incident_reports`                                       | Flight safety: learn from incidents | Legitimate interest (flight safety); named reports also record a consent row | Safety officers; the reporter (own named / community-anonymous reports) | Report kept; reporter link, contact flag and injury details removed 365 days after closing (`incident_personal_details`) | Yes, EU    |
| Reporter identity                                                  | `incident_reports.reporter_id`                           | Follow-up questions                 | Same as above                                                                | Safety officers only; never stored for fully anonymous reports          | As above                                                                                                                 | Yes, EU    |
| **Injury details (health data)**                                   | `incident_injuries.details_enc` (AES-256-GCM in the app) | Safety analysis                     | **Explicit consent** (KVKK Art. 6 / GDPR Art. 9), given in the form          | Safety officers (every read audited) and the reporter                   | Deleted 365 days after closing                                                                                           | Yes, EU    |
| Safety officers' notes                                             | `incident_notes`                                         | Case handling                       | Legitimate interest                                                          | Safety officers                                                         | With the report                                                                                                          | Yes, EU    |
| Event sign-ups (answer, note)                                      | `event_rsvps`                                            | Organise events                     | Contract                                                                     | The user; organisers (instructors, admins)                              | 365 days after the event                                                                                                 | Yes, EU    |
| Ride posts (date, time, from/to, seats, note)                      | `rides`                                                  | Carpool and retrieve                | Contract                                                                     | Adult members; moderators                                               | 30 days after the ride date                                                                                              | Yes, EU    |
| Group chat membership and messages                                 | `chats`, `chat_members`, `messages`                      | Group conversations                 | Contract                                                                     | Group members; moderators only on a report                              | Until deleted (as 1-to-1 chats)                                                                                          | Yes, EU    |
| Position on the SOS page                                           | Browser only                                             | Tell rescuers where you are         | —                                                                            | Only the user; never sent to our server                                 | Not stored                                                                                                               | No         |

Weather is fetched by our server from **Open-Meteo** with the site's coordinates only (no user data).
The airspace layer loads tiles from **OpenAIP** only after the user presses "Show map" and only when the
club has set an OpenAIP key.

## 1e. Personal data added in Phase 5 (trips and pilot profile)

| Data                                                                                             | Where                                                          | Purpose                                             | Legal basis                                                                                              | Who can access                                                                    | Retention                                                                           | Leaves TR? |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Year started flying, total flight hours, number of flights                                       | `profiles.flying_since`, `total_flight_hours`, `total_flights` | Community profile, trip requirements                | Contract; visibility chosen per field (`flight_totals` public for adults, private for minors by default) | Per field                                                                         | Cleared at deletion request                                                         | Yes, EU    |
| Pilot weight                                                                                     | `profiles.weight_kg`                                           | Wing size and tandem planning                       | Contract; private by default (`weight`)                                                                  | Only the user unless they choose otherwise                                        | Cleared at deletion request                                                         | Yes, EU    |
| Trip interest                                                                                    | `trip_interests`                                               | Send updates about a trip                           | Contract                                                                                                 | The user; trip organisers and guides                                              | Deleted with the trip or the account                                                | Yes, EU    |
| Trip registration: phone, emergency contact name and phone, note, companions                     | `trip_registrations`                                           | Organise the trip and reach someone in an emergency | Contract (emergency contact: legitimate interest in flight safety)                                       | The user; organisers (instructors, trip organisers, admins) and the trip's guides | Phone and emergency contact removed 30 days after the trip (`trip_contact_details`) | Yes, EU    |
| Trip registration: status, payment status, snapshot of level / years / flights, organisers' note | `trip_registrations`                                           | Seat allocation and manual payment tracking         | Contract                                                                                                 | As above; the organisers' note is not shown to the pilot                          | 730 days after the trip (`trip_registrations`)                                      | Yes, EU    |

Trip guides are named on the public trip page (from `profile_cards`). The app takes no payments; the
organisers record payment status by hand.

## 1f. Phase 6 (flight replay)

- `flights.xc_type`, `xc_distance_m`, `xc_points`: a score computed by the server from the track,
  visible wherever the flight is. Only the numbers are stored; the scored route (which can start at
  takeoff and end at landing) is drawn only for the owner.
- Replaying flights together uses the same visibility rules: other pilots' flights come from
  `/api/flights/[id]/track`, which returns the trimmed public track unless the viewer is the owner.

## 1g. Phase 7a (iPhone app)

- Recorded flights stay on the phone (IGC files) until the pilot is signed in and online; then they
  are uploaded and analysed like a web import (`/api/mobile/flights`).
- `active_flights`: one row per pilot **while the phone records** (start time and last refresh, no
  position). Owner-only (RLS); deleted when recording stops and with the account. Used only to show
  the website's Fly button as "Flying".
- Sample records (`supabase/samples/sample_data.sql`, marked "(Ö)"/"(S)") are invented people with
  `@example.invalid` addresses: no personal data. Delete them before launch.

## 1h. Club administration (2026-10-30)

- `user_groups`, `user_group_members`: which groups a person is in (e.g. "Students 2026"). Kept by
  admins; a person sees their own groups. Removed with the account; included in the data export.
- `club_messages`, `club_message_recipients`: messages the super admin sends to everyone, a role or
  a group, and who received and read them. A person sees only messages they received. Recipient
  rows go with the account; the message text stays (it is the club's own text). Included in the
  export. Sending is audited.
- `profile_private.licence_body`: which body issued the licence (THK, APPI, …). Owner-only.
- Admin profile edits (`admin_update_profile`) and photo removals are written to `audit_log`.
- Admin user detail page (`admin_user_overview`): admins see a member's profile, flight list and
  summary (no tracks), equipment, listings and notices; every view is written to `audit_log`
  (`profile.admin_viewed`). Admins can correct country, flying-since and licence body, and delete
  an account for the member (`admin_request_account_deletion`: same anonymise-then-purge path,
  audited with a reason). Only the super admin manages other admins. **Mention in the privacy
  notice that club admins can see this.**
- `profiles.last_seen_at` and `user_activity`: when someone was last online and what they did
  (visits, flights added, listings, RSVPs, trip registrations, comments, rides), for admins. No
  message contents, no positions. Kept 90 days (`retention_policies.user_activity`); the person can
  read their own log, and it is in the export. **Add to the privacy notice before launch.**
- `notices` (notice board, "Duyurular", replaces the ride board): offer/request posts with category,
  title, optional description, site or place, date, seats, price and one photo (`notice-photos`
  bucket, private, resized in the browser so no EXIF/GPS). Adult members and moderators read them;
  owners edit, close, renew (max 30 days ahead) or delete. A post closes itself after 30 days and is
  deleted 30 days after that (`retention_policies.notices`). Photos are removed with the account;
  rows are in the export. Upcoming ride posts were copied over; `rides` gets no new posts.

### Special category data

**Incident reports** may contain health data (injuries): explicit consent in the form
(`special_category_consent` on the report), safety officer access only (admins excluded), encrypted
in the app, audit of every read and every report view, shorter retention (`incident_personal_details`:
anonymised 365 days after closure). Reports are designed not to ask for other people's names.

### Location data (from Phase 2)

GPS tracks reveal home addresses and routines. Decision: adults' new flights default to **public** with
the first/last 500 m hidden; minors' flights are always private (database trigger). The full track
never leaves the owner's account; share images are drawn from the trimmed track. The lawyer should
confirm the public default against GDPR Art. 25 (privacy by default). Live-location sharing will need
its own consent.

## 2. Processors and transfers

| Processor                                                              | Role                                                                     | Location                                                                             | Safeguard to complete                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Supabase Inc. (on AWS)                                                 | Database, auth, storage                                                  | EU: Ireland (eu-west-1) for the hosted test server since 2026-10-29; local otherwise | Supabase DPA; KVKK Art. 9 standard contract notified to the Authority within 5 business days of signing |
| Web server host (Oracle Cloud or an EU VPS; owner's choice)            | Runs the web app; sees IPs; holds the nightly encrypted database backups | EU, Frankfurt / Germany                                                              | DPA + KVKK standard contract                                                                            |
| Brevo (Sendinblue SAS)                                                 | Sign-up, reset, guardian emails                                          | EU, France                                                                           | DPA + KVKK standard contract                                                                            |
| Google (only if Google sign-in is enabled)                             | Identity provider                                                        | USA/global                                                                           | Google's terms; user chooses this option; mention in privacy notice                                     |
| Sentry (not used yet)                                                  | Error tracking, only after analytics consent                             | EU region                                                                            | DPA + KVKK standard contract                                                                            |
| Browser push services (Google FCM, Mozilla, Apple)                     | Deliver push messages to the user's browser                              | Global                                                                               | Payload is short (sender name + preview); user turns push on per device; mention in privacy notice      |
| YouTube / Vimeo (only when the reader presses play)                    | Video embeds in tips                                                     | USA/global                                                                           | Click-to-load (no request before consent); youtube-nocookie.com and Vimeo `dnt=1`; privacy notice       |
| OpenFreeMap (only when the user presses "Show map")                    | Map tiles for flights and sites                                          | To confirm (OpenFreeMap project servers)                                             | Click-to-load; no account or cookies; mention in privacy notice                                         |
| EOX Sentinel-2 cloudless (only when the user turns on satellite or 3D) | Satellite imagery for the flight replay (CC BY-NC-SA 4.0, credited)      | EOX IT Services (Austria, EU)                                                        | Click-to-load; no account or cookies; mentioned in the privacy notice                                   |
| AWS Open Data Terrain Tiles (only when the user turns on 3D)           | Elevation tiles for the 3D flight replay                                 | AWS (S3, us-east-1)                                                                  | Click-to-load; no account or cookies; mentioned in the privacy notice                                   |
| Open-Meteo (server to server)                                          | Weather forecasts per site                                               | EU (Switzerland/Germany)                                                             | Only site coordinates are sent, no personal data; free non-commercial use                               |
| OpenAIP (only with a key and after "Show map")                         | Airspace tiles                                                           | To confirm (Germany)                                                                 | Click-to-load; the user's IP and map area reach OpenAIP; mention in privacy notice                      |

**KVKK Art. 9 (since June 2024):** transfers abroad need an adequacy decision or appropriate safeguards.
For each processor above, the club signs the Board's standard contract (or relies on another listed
safeguard) and **notifies the Authority within 5 business days** of signing.

**VERBİS:** the club should ask the lawyer whether registration in the data controllers' registry is
required (thresholds and exemptions depend on employees, balance sheet and main activity).

## 3. Data-subject rights in the app

| Right                     | How                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access / portability      | Account → Privacy → Download my data (JSON incl. flights, full tracks, equipment, chats sent, reports, own incident reports with injury details, event sign-ups, rides, notices); each flight page offers the original IGC/GPX; Logbook → CSV |
| Rectification             | Edit profile; or file a request                                                                                                                                                                                                               |
| Erasure                   | Account → Privacy → Delete account (immediate anonymisation, purge after 30 days)                                                                                                                                                             |
| Withdraw consent          | Account → Privacy → toggle off (as easy as giving it)                                                                                                                                                                                         |
| Object / restrict / other | Account → Privacy → Other requests (due date tracked)                                                                                                                                                                                         |
| By email                  | info@flyanatolia.com → admin logs it in Admin → Data requests (deadline tracked)                                                                                                                                                              |

## 4. Open points for the lawyer (Phase 1)

- Privacy notice must mention: chat (incl. moderator access only on reports), push notifications and the
  browser push services, YouTube/Vimeo when a video is played, public ad photos, report handling and bans.
- Retention for `reports` and `account_deletions`.
- Whether a minor may contact adult sellers (currently allowed; adults can contact a minor only if the
  minor follows them).
- Phase 2: public-by-default flights for adults (with 500 m trimming), and the OpenFreeMap tile requests
  in the privacy notice.
- Phase 3: the incident consent wording and the 365-day retention for reporter and injury data; whether
  "legitimate interest" covers non-health incident data; that admins are excluded from incident reports;
  the adults-only rule for rides and group chats; OpenAIP in the privacy notice.
