# Launch checklist (public beta)

Work top to bottom. Items marked **owner** need someone from the club; the rest is in the code.

## Before the beta

- [ ] **Owner:** choose where the web app runs (see `docs/COSTS.md`) and create the server.
- [ ] **Owner:** create the Supabase project in Frankfurt and push the schema (`deploy/README.md` §1).
- [ ] **Owner:** create the Brevo account, verify `flyanatolia.com` (DKIM/SPF), set custom SMTP in Supabase.
- [ ] **Owner:** add the DNS record `app.flyanatolia.com` → server IP.
- [ ] **Owner:** fill `deploy/.env` and keep a copy in a password manager (encryption keys, backup passphrase).
- [ ] **Owner:** start the stack (`docker compose up -d --build`) and open the site.
- [ ] **Owner:** sign up, make yourself admin (README, "Make yourself an admin"), give the
      `safety_officer` role to one or two trusted people, and the `instructor` role to instructors.
- [ ] **Owner:** add the real sites (or keep the example sites after checking them), first news post, first event.
- [ ] **Owner:** set up a free uptime monitor on `/api/health`.
- [ ] **Owner:** run one backup restore into a scratch Supabase project.

## Legal (must be done before real users sign up)

- [ ] **Lawyer:** review `docs/legal/*` (privacy notice, terms, explicit consent; TR is the binding text)
      and the open points in `docs/DATA_INVENTORY.md` §4. After changes, run
      `node scripts/gen-legal-seed.mjs` and load the new texts.
- [ ] **Lawyer:** confirm the incident-report consent wording in the app (health data, KVKK Art. 6) and
      the one-year retention for reporter and injury data.
- [ ] **Owner:** sign the data processing agreements (Supabase, Brevo, the server host) and, for transfers
      abroad, the KVKK standard contract; notify the Authority within 5 business days of signing.
- [ ] **Owner:** ask the lawyer whether VERBİS registration is needed.
- [ ] **Owner:** decide who answers data-subject requests (Admin → Data requests) and breach reports
      (`docs/BREACH_RUNBOOK.md`).

## Beta

- [ ] Invite a small group (10–30 club members, including a minor with a guardian, to test that flow).
- [ ] Watch the admin area for reports and data requests during the first weeks.
- [ ] Collect feedback; fix and redeploy (`deploy/README.md` §5).
- [ ] Before opening to everyone: revisit Supabase free-tier limits (storage fills first) and backups for
      files.

## Checked in code (Phase 4)

- Automated accessibility checks (axe, WCAG 2.1 AA) on public pages in light and dark mode.
- Lighthouse on the home page: performance 87 (mobile, throttled), accessibility/SEO/best practices 100.
- Security headers (CSP, HSTS, no framing), robots.txt, sitemap.xml, localized error pages.
- Offline SOS page; no personal pages cached on the device.
- Manual checks still worth doing on real phones: keyboard-only use of forms, a screen reader
  (VoiceOver/TalkBack) on sign-up and SOS, push notifications on Android and on iPhone (home-screen app).
