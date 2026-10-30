-- "Öğrenci pilot": in basic training, not flying solo yet (Irmak, 2026-10-30). Own migration because
-- a new enum value cannot be used in the transaction that adds it.
alter type public.app_role add value if not exists 'student_pilot' before 'pilot';
