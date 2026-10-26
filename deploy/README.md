# Deploying ParaApp

The production setup is two parts:

1. **Database, auth and file storage:** a Supabase project in the EU (Frankfurt), free tier for the beta.
2. **Web app:** the Docker image from the root `Dockerfile`, run with `deploy/compose.yaml` on one
   small Linux server. Caddy gets the HTTPS certificate automatically. A scheduler sends due push
   notifications, and a nightly job writes encrypted database backups.

Everything below uses free tiers. The server can be an Oracle Cloud "Always Free" VM or any EU VPS
(see `docs/COSTS.md`).

## 1. Supabase project

1. Create a project at supabase.com. Pick region **Central EU (Frankfurt)** and save the database password.
2. Push the schema from your computer:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push            # applies supabase/migrations
   ```
3. Load the legal texts (and, if you like, the example sites) once. In the dashboard's SQL editor,
   paste and run `supabase/seed.sql`, then `supabase/seeds/demo_sites.sql`.
   **Do not** load `demo_content.sql` in production: it is example news and tips.
4. Check that the nightly clean-up jobs exist: run `select jobname, schedule from cron.job;` in
   the SQL editor. You should see about ten rows (account purge, retention clean-ups). The migrations
   switch on `pg_cron` and `postgis` themselves.
5. **Authentication → URL configuration:** set Site URL to `https://app.flyanatolia.com` and add
   `https://app.flyanatolia.com/**` to the redirect URLs.
6. **Authentication → Emails → SMTP settings:** turn on custom SMTP. Supabase's built-in mailer only
   sends a few emails per hour and only to team members. Use the same Brevo account as the app (step 3).
7. **Authentication → Emails → Templates:** copy the four templates from `supabase/templates/`.
   Or run `npx supabase config push`, which sends `supabase/config.toml` (including templates and the
   URL settings) to the project. Check the URL values in that file first.
8. **Project Settings → API:** copy the URL, the anon (publishable) key and the service role
   (secret) key into `deploy/.env` (step 4).

## 2. Domain

At the DNS provider for flyanatolia.com, add an **A record**: `app` → the server's public IP address.

## 3. Email (Brevo, free: 300 emails/day)

1. Create a free account at brevo.com and verify the sender domain `flyanatolia.com`. Brevo shows the
   DKIM and SPF records to add at the DNS provider.
2. **SMTP & API → SMTP:** copy the login and create an SMTP key. Use them for both the app
   (`SMTP_USER`, `SMTP_PASS`) and Supabase's custom SMTP.

## 4. Server

### Oracle Cloud Always Free (€0)

1. Sign up at cloud.oracle.com with home region **Germany Central (Frankfurt)**. A card is needed to
   verify the account, but Always Free resources are not charged.
2. Create a compute instance: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Ampere, Always
   Free eligible), 1 OCPU and 6 GB of memory are plenty. Add your SSH key.
3. In the instance's **subnet → security list**, allow ingress on TCP 80 and 443 (and UDP 443).
4. On the server, open the same ports in the firewall:
   ```bash
   sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT
   sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

Oracle may reclaim Always Free VMs that stay almost idle for a week. A live app is rarely idle, but if
it happens, the same steps work on any VPS.

### Any other Linux server (e.g. a small EU VPS)

Ubuntu 24.04 with ports 80 and 443 open. 1 vCPU and 2 GB of memory are enough for the beta.

### Install and start

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# The app
git clone https://github.com/irmakerol/paraapp.git && cd paraapp/deploy
cp .env.example .env && nano .env      # fill in every value
docker compose up -d --build           # first build takes a few minutes
docker compose logs -f web             # Ctrl+C to stop following
```

Open https://app.flyanatolia.com. Caddy fetches the certificate on the first request.

Generate the secrets with:

```bash
openssl rand -base64 32   # LICENCE_ENCRYPTION_KEY, INCIDENT_ENCRYPTION_KEY (two different keys)
openssl rand -hex 32      # CRON_SECRET, BACKUP_PASSPHRASE
npx web-push generate-vapid-keys   # NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

**Keep a copy of `deploy/.env` in a password manager.** Without the two encryption keys, licence
numbers and injury details cannot be read. Without the backup passphrase, backups cannot be restored.

## 5. Updating

```bash
cd paraapp && git pull
npx supabase db push        # from your computer, if there are new migrations
cd deploy && docker compose up -d --build
```

## 6. Backups

- **Database:** `backup` writes `deploy/backups/paraapp-<date>.dump.gpg` every night and keeps 14 days.
  Copy one to another place regularly, for example a club laptop:
  `scp server:paraapp/deploy/backups/*.gpg ./`.
  Restore into an empty Supabase project:
  `gpg -d FILE.dump.gpg | pg_restore -d "$NEW_DB_URL" --clean --if-exists --no-owner`.
- **Files** (avatars, ad and chat photos, IGC files) live in Supabase Storage and are not part of the
  database dump. Supabase keeps them, but the free tier has no point-in-time restore. Before the files
  matter much (or on the Pro plan), add a weekly copy with `rclone` using Supabase's S3-compatible
  storage endpoint.
- Test a restore once before launch. The breach and incident runbook is in `docs/BREACH_RUNBOOK.md`.

## 7. Health and monitoring

- `https://app.flyanatolia.com/api/health` returns `{"ok":true}` when the app is running.
- A free uptime monitor (e.g. UptimeRobot, 5-minute checks) on that URL emails you if the site goes down.
