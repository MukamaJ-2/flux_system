/*
# Loan eligibility rules

1. Changes
Adds three configurable thresholds to `group_settings` so the Chair can
tune them instead of them being hardcoded in the edge function:
- `min_membership_months` — how long someone must have been a member
  before requesting a loan.
- `max_loan_multiple_of_savings` — a loan can't exceed this multiple of
  the borrower's own ledger balance.
- `max_loan_percent_of_fund` — a loan can't exceed this percentage of the
  group's total fund.
Defaults are permissive (0 months, 1000x savings, 100% of fund) so
existing behavior doesn't suddenly break for a group that hasn't
configured them yet — the Chair dials them down to something meaningful
for their group via the new Settings page.
*/

ALTER TABLE public.group_settings
  ADD COLUMN IF NOT EXISTS min_membership_months integer NOT NULL DEFAULT 0 CHECK (min_membership_months >= 0),
  ADD COLUMN IF NOT EXISTS max_loan_multiple_of_savings numeric(6,2) NOT NULL DEFAULT 1000 CHECK (max_loan_multiple_of_savings >= 0),
  ADD COLUMN IF NOT EXISTS max_loan_percent_of_fund numeric(5,2) NOT NULL DEFAULT 100 CHECK (max_loan_percent_of_fund >= 0);
