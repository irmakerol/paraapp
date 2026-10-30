# Phone app (iOS first)

`apps/mobile` is an Expo (React Native, SDK 54) app: flight recorder, flight list and upload to
the logbook, sign-in with Apple, Google or email. It reuses the track code in
`packages/core/src/tracks` (IGC writer, flight analysis) through a Metro alias
(`@paraapp/core-tracks`). It is **not** part of the pnpm workspace: native builds expect npm's
flat `node_modules`, so use `npm` inside `apps/mobile`.

## How it fits together

- **Recording** works offline and without an account. `expo-location` delivers fixes to a
  background task (`src/tracker/task.ts`), which writes them to disk in small chunks
  (`src/tracker/recorder.ts`). Takeoff and landing are detected in `src/tracker/live.ts`; after
  5 minutes still on the ground the recording stops by itself. The flight is saved as an IGC file.
- **Vario**: barometer (`expo-sensors`, relative altitude) while the app runs, GPS climb as the
  fallback. The sound is generated WAV beeps (`src/tracker/vario-audio.ts`).
- **Sign-in**: native Apple / Google sign-in, exchanged for a Supabase session with
  `signInWithIdToken`. Onboarding (age, legal, consents) mirrors the website; the age step goes
  through `POST /api/mobile/age` so under-age accounts are deleted on the server.
- **Upload**: `POST /api/mobile/flights` with `Authorization: Bearer <access token>` runs the same
  server-side import as the website (`importTrack`). Then `add_flights_to_totals` if the pilot said
  yes after landing.

## Hosted test server

`.github/workflows/cloud.yml` checks the secrets (`scripts/check-secrets.sh`, never prints values) and runs `scripts/cloud-setup.sh`: Supabase Cloud (migrations, legal
texts, example sites, Apple/Google sign-in settings) and the website on Vercel (env vars, keys
generated once). Both are free tiers, see `docs/COSTS.md`.

## Builds and TestFlight

`.github/workflows/ios.yml` builds on a GitHub macOS runner (free for public repos; pushes only compile, a TestFlight upload needs a manual "Run workflow"), runs
`expo prebuild`, archives with Xcode, and uploads to TestFlight using an App Store Connect API
key (Xcode's automatic, cloud-managed signing: no certificates to keep). Without the Apple
secrets it only does an unsigned compile check. The build number is the workflow run number.

### Secrets (repo → Settings → Secrets and variables → Actions)

| Secret                                                                     | Used for                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`               | Signing and TestFlight upload (API key with the Admin role)                              |
| `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`    | Hosted database and sign-in                                                              |
| `ADMIN_EMAIL` (optional)                                                   | This account gets the admin and member roles once it has signed in (re-run the workflow) |
| `VERCEL_TOKEN`                                                             | Hosted website (project `fly-anatolia`)                                                  |
| `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` | Google sign-in                                                                           |

The repository is public, so workflow logs are public: scripts mask every generated or fetched
key with `::add-mask::` and never print one.

## Local development

```bash
cd apps/mobile
npm install
cp .env.example .env.local   # point it at your local Supabase / web app
npm run typecheck && npm test
npx expo prebuild -p ios     # needs a Mac with Xcode to run the generated project
```
