/*
# Default password + forced change, instead of email invite links

1. Why
Supabase's magic-link invite/recovery flow has been unreliable in this
project's setup — it depends on the project's Auth "Site URL"/redirect
allow-list being configured correctly (which needed dashboard access this
session's tokens didn't have), on Supabase's default mailer not being
rate-limited, and on links not expiring before the member gets to them.
Replacing it with the pattern the v1 version of this app used: the Chair
sets/shares a default password directly (in person, WhatsApp, etc.), the
member logs in with it immediately, and the app forces a password change
on that first login. No email dependency at all.

2. Changes
- `profiles.must_change_password` — true for anyone who still needs to set
  their own password. New accounts default to true; backfilled to false
  for accounts that already exist (they've already been using the app).
- `handle_new_user()` trigger updated to also read `must_change_password`
  from the new user's metadata, so an account created with a default
  password can be flagged appropriately at creation time.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
UPDATE public.profiles SET must_change_password = false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar, must_change_password)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'avatar', ''),
    COALESCE((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  );
  RETURN new;
END;
$$;
