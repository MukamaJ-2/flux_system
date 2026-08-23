/*
# Unlimited contributions + investments

1. Changes
- Drop the `UNIQUE (member_id, period)` constraint on `contributions`. It
  was built assuming one submission per member per month; the actual
  requirement is that a member can log a contribution as many times as
  they want. `period` stays on the row for reporting, it just isn't a key
  anymore.
- New `investments` table: the group logs money put into an investment,
  then later records what actually came back. Recording a return posts a
  ledger entry (handled in the edge function, not here) so the profit
  shows up in the group total like every other transaction.

2. Security
- RLS enabled, matching every other table. Read is open to any signed-in
  member (same transparency stance as `ledger_entries`); write is
  restricted to Treasurer/Chair via the `has_role()` helper from the
  Phase 1 migration.
*/

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_member_id_period_key;

CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description varchar(255) NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  expected_return bigint CHECK (expected_return >= 0),
  actual_return bigint CHECK (actual_return >= 0),
  invested_at date NOT NULL DEFAULT CURRENT_DATE,
  returned_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investments_status_idx ON public.investments(status);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY investments_select_all ON public.investments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY investments_insert_treasurer_or_chair ON public.investments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('treasurer') OR public.has_role('chair'));
