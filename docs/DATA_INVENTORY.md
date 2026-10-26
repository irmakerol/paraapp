# Data inventory (KVKK / GDPR) – draft

Status: **draft for the club's lawyer**, Phase 1. Updated whenever a feature adds personal data.
Controller: Fly Anatolia Havacılık Kulübü (dernek), Kordonboyu Mah. Ankara Cd. No:27 D:108,
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

### Special category data

None in Phase 0. **Phase 3 incident reports** will contain health data (injuries): explicit consent
(`incident_special_category`), safety officer access only, encrypted columns, audit of every read,
shorter retention (`incident_personal_details`: anonymised 365 days after closure).

### Location data (from Phase 2)

GPS tracks reveal home addresses and routines. Decision: adults' new flights default to **public** with
the first/last 500 m hidden; minors' flights default to private. The lawyer should confirm this against
GDPR Art. 25 (privacy by default). Live-location sharing will need its own consent.

## 2. Processors and transfers

| Processor                                              | Role                                         | Location                                            | Safeguard to complete                                                                                   |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Supabase Inc. (on AWS)                                 | Database, auth, storage                      | EU, Frankfurt (eu-central-1) when hosted; local now | Supabase DPA; KVKK Art. 9 standard contract notified to the Authority within 5 business days of signing |
| Hosting for the web app (Cloudflare or an EU VPS, TBD) | Serves the site; sees IPs                    | TBD (EU preferred)                                  | DPA + KVKK standard contract                                                                            |
| Email provider (TBD, Phase 4)                          | Sign-up, reset, guardian emails              | TBD (EU preferred)                                  | DPA + KVKK standard contract                                                                            |
| Google (only if Google sign-in is enabled)             | Identity provider                            | USA/global                                          | Google's terms; user chooses this option; mention in privacy notice                                     |
| Sentry (not used yet)                                  | Error tracking, only after analytics consent | EU region                                           | DPA + KVKK standard contract                                                                            |
| Browser push services (Google FCM, Mozilla, Apple)     | Deliver push messages to the user's browser  | Global                                              | Payload is short (sender name + preview); user turns push on per device; mention in privacy notice      |
| YouTube / Vimeo (only when the reader presses play)    | Video embeds in tips                         | USA/global                                          | Click-to-load (no request before consent); youtube-nocookie.com and Vimeo `dnt=1`; privacy notice       |

**KVKK Art. 9 (since June 2024):** transfers abroad need an adequacy decision or appropriate safeguards.
For each processor above, the club signs the Board's standard contract (or relies on another listed
safeguard) and **notifies the Authority within 5 business days** of signing.

**VERBİS:** the club should ask the lawyer whether registration in the data controllers' registry is
required (thresholds and exemptions depend on employees, balance sheet and main activity).

## 3. Data-subject rights in the app

| Right                     | How                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- |
| Access / portability      | Account → Privacy → Download my data (JSON; flight files added in Phase 2)        |
| Rectification             | Edit profile; or file a request                                                   |
| Erasure                   | Account → Privacy → Delete account (immediate anonymisation, purge after 30 days) |
| Withdraw consent          | Account → Privacy → toggle off (as easy as giving it)                             |
| Object / restrict / other | Account → Privacy → Other requests (due date tracked)                             |
| By email                  | info@flyanatolia.com → admin logs it in Admin → Data requests (deadline tracked)  |

## 4. Open points for the lawyer (Phase 1)

- Privacy notice must mention: chat (incl. moderator access only on reports), push notifications and the
  browser push services, YouTube/Vimeo when a video is played, public ad photos, report handling and bans.
- Retention for `reports` and `account_deletions`.
- Whether a minor may contact adult sellers (currently allowed; adults cannot contact minors).
