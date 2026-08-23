-- Notices: secretary broadcasts to group members
CREATE TABLE IF NOT EXISTS public.groups_notice (
  id varchar(50) PRIMARY KEY,
  group_id varchar(50) NOT NULL REFERENCES public.groups_group(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES public.users_user(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL DEFAULT 'general',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Issues: mobilizer-tracked problems
CREATE TABLE IF NOT EXISTS public.groups_issue (
  id varchar(50) PRIMARY KEY,
  group_id varchar(50) REFERENCES public.groups_group(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES public.users_user(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status varchar(50) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Audit logs: hash-chain verification results
CREATE TABLE IF NOT EXISTS public.groups_auditlog (
  id varchar(50) PRIMARY KEY,
  group_id varchar(50) REFERENCES public.groups_group(id) ON DELETE CASCADE,
  auditor_id bigint NOT NULL REFERENCES public.users_user(id) ON DELETE CASCADE,
  hash_chain text NOT NULL DEFAULT '',
  record_count integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_notice_group_id_idx ON public.groups_notice(group_id);
CREATE INDEX IF NOT EXISTS groups_issue_group_id_idx ON public.groups_issue(group_id);
CREATE INDEX IF NOT EXISTS groups_auditlog_group_id_idx ON public.groups_auditlog(group_id);

ALTER TABLE public.groups_notice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups_issue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups_auditlog ENABLE ROW LEVEL SECURITY;
