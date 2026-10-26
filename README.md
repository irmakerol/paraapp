# ParaApp

The paragliding community app of **Fly Anatolia Havacılık Kulübü**: news, tips, a gear market,
a flight logbook and safety reports for pilots in Türkiye. Web first, Turkish and English.

> Status: **Phase 2 (flights & sites)**. Accounts and privacy (Phase 0), news, tips, the gear market,
> chat, push and the admin area (Phase 1), plus the logbook (IGC/GPX import, map, altitude chart,
> exports), equipment reminders, flying sites, pilot pages and follows. Safety reports, weather and
> events come in Phase 3 (see `docs/PLAN.md`).

## Run it on your computer

You need, once:

1. **Node.js 22** – https://nodejs.org (the LTS installer is fine).
2. **pnpm** – open a terminal and run `corepack enable`.
3. **Docker Desktop** – https://www.docker.com/products/docker-desktop (free for small non-profits).
   Start it and leave it running; the local database runs inside it.
4. **Git** – https://git-scm.com

Then, in a terminal:

```bash
git clone https://github.com/irmakerol/paraapp.git
cd paraapp
pnpm install

# 1. Start the local backend (database, auth, storage, mail catcher). First run downloads images.
pnpm db:start
```

When it finishes it prints a list of URLs and keys. Keep that window's output handy (you can show
it again with `npx supabase status`).

```bash
# 2. Create your local settings file
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` in a text editor and fill in:

| Setting                         | Where to find it                                                |
| ------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "Publishable key" (or "anon key") from `npx supabase status`    |
| `SUPABASE_SERVICE_ROLE_KEY`     | "Secret key" (or "service_role key") from `npx supabase status` |
| `LICENCE_ENCRYPTION_KEY`        | run `openssl rand -base64 32` and paste the result              |
| `INCIDENT_ENCRYPTION_KEY`       | run `openssl rand -base64 32` again (a different key)           |
| `NEXT_PUBLIC_OPENAIP_API_KEY`   | optional: free key from openaip.net for the airspace map layer  |

```bash
# 3. Start the web app
pnpm dev
```

Open http://localhost:3000. Emails (sign-up confirmation, magic links, guardian consent) are not
really sent locally: read them at **http://127.0.0.1:54324**. The database admin UI (Supabase
Studio) is at http://127.0.0.1:54323.

`pnpm db:reset` reloads a few example news articles and tips (marked "example"). Delete them from the
admin area before launch.

### Safety officers

Incident reports are only visible to users with the `safety_officer` role (admins do not see them).
Give the role to one or two trusted people in Admin → Users.

### Make yourself an admin

Sign up in the app first. Then open Studio (http://127.0.0.1:54323), go to **SQL Editor**, and run
(replace the email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

Then open http://localhost:3000/tr/admin. From there you can give other people roles: **Member**
(verified club member), **Instructor** (writes and reviews tips), **Moderator** (handles reports and
bans) and **Admin**.

### Push notifications (optional)

1. Run `npx web-push generate-vapid-keys` once.
2. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY` in
   `apps/web/.env.local`, then restart `pnpm dev`.
3. In the app: **My account → Notifications → Turn on for this device**.

Scheduled news and ad-expiry reminders are pushed when something calls the app's notify endpoint. To
try it locally, set `CRON_SECRET` in `.env.local` and run:

```bash
curl -X POST -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/notify
```

### Google sign-in (optional)

1. In Google Cloud Console create an OAuth client (type "Web application") with the redirect URI
   `http://127.0.0.1:54321/auth/v1/callback`.
2. Copy `supabase/.env.example` to `supabase/.env` and paste the client ID and secret.
3. Set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`, and
   `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in `apps/web/.env.local`.
4. Restart: `pnpm db:stop && pnpm db:start`, then `pnpm dev`.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test   # code style, types, unit tests
npx supabase test db                        # database security (RLS) tests, needs Docker
pnpm --filter @paraapp/web build && pnpm test:e2e   # browser tests
```

## Where things are

- `apps/web` – the website (Next.js)
- `packages/core` – shared logic (age rules, privacy, units, validation)
- `supabase` – database schema, security rules, tests, email templates
- `docs` – architecture, plan, data inventory (KVKK/GDPR), costs, breach runbook, legal drafts
- `CLAUDE.md` – conventions for anyone (human or AI) working on the code

Legal texts in `docs/legal` are **drafts** and must be reviewed by the club's lawyer before launch.

Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Weather data by Open-Meteo.com.
Airspace © OpenAIP.
