-- Permit only existing, RLS-authorized city admins to edit place coordinates.
-- These columns already exist with range + pair-presence CHECK constraints.
-- No grants on user records, no additional roles, no change to existing map pins.
BEGIN;
GRANT INSERT (latitude, longitude) ON public.organizations TO authenticated;
GRANT UPDATE (latitude, longitude) ON public.organizations TO authenticated;
COMMIT;
