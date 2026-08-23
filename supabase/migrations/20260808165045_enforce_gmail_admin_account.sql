/*
# Enforce Gmail registration and assign the requested administrator

1. Changes
- Replace the existing system administrator email with `mukamajoseph010@gmail.com`.
- Add a database check so every user email ends in `@gmail.com`.
- Keep the existing password hash and sysadmin role for the administrator.

2. Security
- Gmail-only registration is enforced at the database boundary, in addition to the backend validation.
- No browser-facing write policies are added; the users table remains deny-by-default through RLS.

3. Notes
- This does not delete any user records.
- Existing non-Gmail accounts, if present, prevent the constraint from being added and must be reviewed rather than silently removed.
*/

UPDATE public.users_user
SET email = 'mukamajoseph010@gmail.com', username = 'mukamajoseph010@gmail.com', role = 'sysadmin', is_staff = true, is_active = true
WHERE role = 'sysadmin' AND email = 'admin@flux.app';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users_user
    WHERE lower(email) NOT LIKE '%@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Gmail-only registration while non-Gmail users exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_user_gmail_email_check'
      AND conrelid = 'public.users_user'::regclass
  ) THEN
    ALTER TABLE public.users_user
      ADD CONSTRAINT users_user_gmail_email_check
      CHECK (lower(email) LIKE '%@gmail.com');
  END IF;
END $$;
