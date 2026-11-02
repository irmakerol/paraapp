-- Roles: "guide" (rehber, a club guide on trips and site days) and "super_admin" (the club owner,
-- the only one who can make or remove admins). Kept in their own migration because a new enum
-- value cannot be used in the transaction that adds it.
alter type public.app_role add value if not exists 'guide' after 'instructor';
alter type public.app_role add value if not exists 'super_admin' after 'admin';
