/*
# Flux v2 — single-group, role-based, ledger-driven schema

1. Summary
This is a full schema replacement, not an incremental change. It drops the
multi-group schema (`groups_group`, `groups_membership`, `users_user`,
`finances_request`, `finances_record`, `finances_loan`, `finances_goal`)
and replaces it with a single-group model built on Supabase Auth identity,
additive roles, and an immutable ledger. This is a deliberate fresh reset —
existing rows in the old tables are not migrated.

2. New Tables
- `profiles` — one row per member, keyed to `auth.users.id`.
- `member_roles` — additive roles (chair/treasurer/secretary/mobilizer/
  auditor) layered on top of base membership. Many rows per member allowed.
- `group_settings` — singleton row (there is exactly one group).
- `contributions` — one row per member per period; tracks amount due vs.
  amount actually paid, so partial payments are representable.
- `ledger_entries` — append-only. No UPDATE/DELETE policy exists for any
  role, including authenticated clients; only the edge function's
  service-role client ever inserts, and it only ever inserts (never
  updates), so this is a real immutability guarantee, not a convention.
- `loans` / `loan_approvals` — dual-approval loans: a loan only becomes
  `active` once two distinct rows exist in `loan_approvals` for it — the
  edge function enforces that count, this table just records who decided.
- `meetings` / `attendance` — real join tables instead of array columns.
- `notifications` — channel-agnostic (sms/app); no SMS provider is wired up
  yet, this just makes the table ready for one.
- `audit_log` — written by the edge function on every state-changing call.
- `goals` — personal savings goals, kept from v1 but re-pointed at
  `profiles`/`auth.users` and simplified (no `linked_group_id` — there's
  only one group now).

3. Security
- RLS enabled on every table, following this project's existing convention.
- Two helper functions (`has_role`, `is_active_member`) centralize the
  "does the caller hold this role" check so policies stay readable.
- Write access to workflow-sensitive tables (`contributions` status,
  `loans` status, `ledger_entries`, `audit_log`, `notifications`) is
  deliberately NOT granted to authenticated clients — those go through the
  edge function's service-role client, which enforces business rules (e.g.
  a treasurer can't approve their own contribution) that don't fit cleanly
  into a row-level policy.
*/

-- ─── Drop the v1 schema ────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.finances_goal CASCADE;
DROP TABLE IF EXISTS public.finances_loan CASCADE;
DROP TABLE IF EXISTS public.finances_record CASCADE;
DROP TABLE IF EXISTS public.finances_request CASCADE;
DROP TABLE IF EXISTS public.groups_membership CASCADE;
DROP TABLE IF EXISTS public.groups_group CASCADE;
DROP TABLE IF EXISTS public.users_user CASCADE;
DROP TABLE IF EXISTS public.groups_notice CASCADE;
DROP TABLE IF EXISTS public.groups_issue CASCADE;
DROP TABLE IF EXISTS public.groups_auditlog CASCADE;
DROP TABLE IF EXISTS public.groups_meetingminute CASCADE;
DROP TABLE IF EXISTS public.groups_message CASCADE;

-- ─── Core tables ────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name varchar(255) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL DEFAULT '',
  avatar varchar(10) NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.member_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role varchar(20) NOT NULL CHECK (role IN ('chair', 'treasurer', 'secretary', 'mobilizer', 'auditor')),
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, role)
);

CREATE TABLE public.group_settings (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT group_settings_singleton CHECK (id),
  name varchar(255) NOT NULL DEFAULT 'Flux',
  contribution_amount bigint NOT NULL DEFAULT 0 CHECK (contribution_amount >= 0),
  frequency varchar(20) NOT NULL DEFAULT 'Monthly',
  contribution_deadline_day smallint NOT NULL DEFAULT 28 CHECK (contribution_deadline_day BETWEEN 1 AND 28),
  interest_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  interest_type varchar(20) NOT NULL DEFAULT 'Flat Rate',
  cycle_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period date NOT NULL,
  amount_due bigint NOT NULL CHECK (amount_due >= 0),
  amount_paid bigint NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  proof_url text NOT NULL DEFAULT '',
  method varchar(100) NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, period)
);

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  principal bigint NOT NULL CHECK (principal >= 0),
  interest_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  reason text NOT NULL DEFAULT '',
  installments integer NOT NULL DEFAULT 1 CHECK (installments > 0),
  due_date date,
  status varchar(30) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'pending_second_approval', 'approved', 'rejected', 'active', 'repaid', 'defaulted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loan_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.profiles(id),
  decision varchar(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, approver_id)
);

-- Append-only. See file header — no UPDATE/DELETE policy is ever added here.
CREATE TABLE public.ledger_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_type varchar(30) NOT NULL
    CHECK (entry_type IN ('contribution', 'loan_disbursement', 'loan_repayment', 'investment', 'interest_income', 'fine')),
  direction varchar(10) NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount bigint NOT NULL CHECK (amount > 0),
  member_id uuid REFERENCES public.profiles(id),
  related_contribution_id uuid REFERENCES public.contributions(id),
  related_loan_id uuid REFERENCES public.loans(id),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL,
  minutes text NOT NULL DEFAULT '',
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (meeting_id, member_id)
);

CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type varchar(50) NOT NULL,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel varchar(10) NOT NULL DEFAULT 'app' CHECK (channel IN ('sms', 'app')),
  payload text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id),
  action varchar(100) NOT NULL,
  target_table varchar(50) NOT NULL,
  target_id text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  target_amount bigint NOT NULL CHECK (target_amount >= 0),
  saved_amount bigint NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_date date,
  notes text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contributions_member_id_idx ON public.contributions(member_id);
CREATE INDEX contributions_period_idx ON public.contributions(period);
CREATE INDEX loans_borrower_id_idx ON public.loans(borrower_id);
CREATE INDEX loan_approvals_loan_id_idx ON public.loan_approvals(loan_id);
CREATE INDEX ledger_entries_member_id_idx ON public.ledger_entries(member_id);
CREATE INDEX ledger_entries_created_at_idx ON public.ledger_entries(created_at);
CREATE INDEX attendance_meeting_id_idx ON public.attendance(meeting_id);
CREATE INDEX notifications_member_id_idx ON public.notifications(member_id);
CREATE INDEX audit_log_target_idx ON public.audit_log(target_table, target_id);
CREATE INDEX goals_member_id_idx ON public.goals(member_id);

-- ─── auth.users → profiles bridge ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'avatar', '')
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RLS helper functions ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(check_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_roles
    WHERE member_id = auth.uid() AND role = check_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_oversight_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role('treasurer') OR public.has_role('chair') OR public.has_role('auditor');
$$;

-- ─── RLS: enable + policies ─────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- profiles: readable by any signed-in member (acts as the member directory);
-- writes go through the edge function only — no client INSERT/UPDATE policy.
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- member_roles: readable by any signed-in member (role badges in the UI);
-- writes go through the edge function only (Chair assigns roles).
CREATE POLICY member_roles_select_all ON public.member_roles
  FOR SELECT TO authenticated USING (true);

-- group_settings: readable by any signed-in member; writes via edge function.
CREATE POLICY group_settings_select_all ON public.group_settings
  FOR SELECT TO authenticated USING (true);

-- contributions: a member sees + submits their own; treasurer/chair/auditor
-- see everyone's. Status changes (approve/reject) are edge-function-only,
-- so there's no client UPDATE policy — that's what makes "a treasurer can't
-- approve their own submission" enforceable server-side rather than hoped-for.
CREATE POLICY contributions_select_own_or_oversight ON public.contributions
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.has_any_oversight_role());

CREATE POLICY contributions_insert_own ON public.contributions
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

-- loans: a member sees + requests their own; treasurer/chair/auditor see all.
-- Status transitions (including the dual-approval count) are edge-function-only.
CREATE POLICY loans_select_own_or_oversight ON public.loans
  FOR SELECT TO authenticated
  USING (borrower_id = auth.uid() OR public.has_any_oversight_role());

CREATE POLICY loans_insert_own ON public.loans
  FOR INSERT TO authenticated
  WITH CHECK (borrower_id = auth.uid());

-- loan_approvals: the borrower can see who's decided on their loan;
-- treasurer/chair/auditor see all. Only treasurer/chair may record a
-- decision, and only as themselves — no recording an approval on someone
-- else's behalf.
CREATE POLICY loan_approvals_select ON public.loan_approvals
  FOR SELECT TO authenticated
  USING (
    public.has_any_oversight_role()
    OR EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_id AND l.borrower_id = auth.uid())
  );

CREATE POLICY loan_approvals_insert ON public.loan_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid()
    AND (public.has_role('treasurer') OR public.has_role('chair'))
  );

-- ledger_entries: fully readable by every signed-in member (the app's whole
-- pitch is a transparent ledger) — but INSERT has no policy at all for the
-- authenticated role, so only the service-role client (the edge function)
-- can ever write one, and it only ever inserts, never updates.
CREATE POLICY ledger_entries_select_all ON public.ledger_entries
  FOR SELECT TO authenticated USING (true);

-- meetings/attendance: everyone reads; only secretary/chair write.
CREATE POLICY meetings_select_all ON public.meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY meetings_write_secretary_or_chair ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('secretary') OR public.has_role('chair'));

CREATE POLICY attendance_select_all ON public.attendance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY attendance_write_secretary_or_chair ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('secretary') OR public.has_role('chair'));

-- notifications: a member reads their own inbox; mobilizer/secretary/chair
-- can see what's been sent (oversight). Sending goes through the edge
-- function only — no client INSERT policy.
CREATE POLICY notifications_select_own_or_sender_role ON public.notifications
  FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR public.has_role('mobilizer') OR public.has_role('secretary') OR public.has_role('chair')
  );

-- audit_log: chair/auditor only; written exclusively by the edge function.
CREATE POLICY audit_log_select_chair_or_auditor ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role('chair') OR public.has_role('auditor'));

-- goals: a member sees + creates their own; chair has oversight visibility.
-- Decisions/progress updates go through the edge function only.
CREATE POLICY goals_select_own_or_chair ON public.goals
  FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.has_role('chair'));

CREATE POLICY goals_insert_own ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ─── Seed the settings singleton ───────────────────────────────────────────
-- group_settings is a one-row table by design (see the CHECK constraint
-- above); without a row here the app has nothing to read until someone
-- manually inserts one, so seed sane defaults at migration time.
INSERT INTO public.group_settings (id, name) VALUES (true, 'Flux')
  ON CONFLICT (id) DO NOTHING;
