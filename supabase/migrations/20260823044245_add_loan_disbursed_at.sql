/*
# Track actual loan disbursal, separate from Chair's approval decision

1. Changes
- Add `disbursed_at` to `finances_loan`. "approved" means the Chair signed
  off; "disbursed" (a new status value, set only via the new
  PATCH /loans/:id/disburse/ endpoint) means Treasury actually paid the
  money out. Keeping these distinct lets Treasury track real payouts
  instead of just approval decisions.

2. Notes
- No new table: `status` already accepts arbitrary text, so "disbursed" is
  just a new value written by the edge function — no constraint change
  needed.
*/

ALTER TABLE public.finances_loan ADD COLUMN IF NOT EXISTS disbursed_at timestamptz;

-- Optional follow-up (not enabled here): schedule the audit hash-chain
-- verification to run automatically instead of only on manual click.
-- Requires the pg_cron extension to be enabled on this project first.
-- select cron.schedule(
--   'nightly-hash-chain-verify',
--   '0 2 * * *',
--   $$ select net.http_post(
--        url := '<your-project-ref>.supabase.co/functions/v1/api/audit-logs/',
--        headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>', 'Content-Type', 'application/json'),
--        body := jsonb_build_object('groupId', '<group-id>')
--      ) $$
-- );
