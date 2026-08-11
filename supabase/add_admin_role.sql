-- Adds 'admin' as a valid public.users.role value, for the Kennisbank
-- (Knowledge Bucket) feature's beheerder-only upload/manage access.
--
-- Kept as its own migration/statement, separate from
-- schema_kennisbank.sql: a new enum value cannot be referenced by name
-- (e.g. in an RLS policy's `role = 'admin'` check) within the same
-- transaction that adds it, so this must run — and commit — first.
alter type public.user_role add value if not exists 'admin';
