# Personal data breach runbook – draft

For the club's board and whoever operates the app. Review with the lawyer.

**Deadlines:** KVKK – notify the Personal Data Protection Board _as soon as possible_, which the Board
interprets as **within 72 hours** of discovery, and inform affected people as soon as reasonably possible.
GDPR (EU users) – notify the supervisory authority within **72 hours** unless the breach is unlikely to
result in a risk; inform affected people without undue delay if the risk is high.

## 1. First hour – contain

1. Write down the time you found out and who told you. Start a private incident log (time, action, person).
2. Stop the leak: rotate exposed keys (Supabase service-role/secret key, `LICENCE_ENCRYPTION_KEY`
   requires re-encryption, SMTP and OAuth secrets), revoke compromised admin sessions and roles,
   take the affected feature offline if needed.
3. Preserve evidence: export relevant logs (Supabase auth/API logs, hosting logs, `audit_log`) before
   they roll over.

## 2. Within 24 hours – assess

- What data, how many people, which categories (health data from incident reports and children's data
  are high risk), is it encrypted, is it still exposed?
- Is it likely to cause harm (identity theft, revealing home addresses from tracks, discrimination)?
- Decide with the board and lawyer: notify the Authority? notify individuals?

## 3. Within 72 hours – notify

- KVKK: online breach notification form on kvkk.gov.tr (Veri İhlali Bildirimi). If you do not have all
  facts, notify with what you know and follow up.
- GDPR: the supervisory authority of the affected EU users, if any.
- Individuals: clear message in Turkish and English — what happened, what data, what we did, what they
  should do (e.g. change password), contact: info@flyanatolia.com.

## 4. Afterwards

- Fix the root cause; add a test that would have caught it (RLS tests in `supabase/tests`).
- Keep the incident log and decisions (KVKK expects a breach record even when not notified).
- Review this runbook.

## Contacts (fill in)

| Role                                         | Name | Phone |
| -------------------------------------------- | ---- | ----- |
| Board member responsible for data protection |      |       |
| Technical operator                           |      |       |
| Lawyer                                       |      |       |
