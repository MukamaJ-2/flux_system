/*
# Meeting minutes and member messaging

1. New Tables
- `groups_meetingminute` — minutes the Secretary logs for a group meeting
  (title, meeting date, body text, who wrote it, when).
- `groups_message` — reminders and meeting invitations the Mobilizer (or
  Chair/Secretary/Sysadmin) sends. `recipient_id` null means the message
  was broadcast to every member of the group; set means it targets one
  member (e.g. a contribution reminder to a specific defaulter).

2. Security
- RLS is enabled on both tables with no policies, so both are deny-by-default
  for the anon/authenticated Postgres roles — matching every other table in
  this schema. All reads/writes go through the edge function's service-role
  client, which enforces membership and role checks in application code.
*/

CREATE TABLE IF NOT EXISTS public.groups_meetingminute (
  id varchar(50) PRIMARY KEY,
  group_id varchar(50) NOT NULL REFERENCES public.groups_group(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES public.users_user(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL DEFAULT '',
  meeting_date date,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups_message (
  id varchar(50) PRIMARY KEY,
  group_id varchar(50) NOT NULL REFERENCES public.groups_group(id) ON DELETE CASCADE,
  sender_id bigint NOT NULL REFERENCES public.users_user(id) ON DELETE CASCADE,
  recipient_id bigint REFERENCES public.users_user(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL DEFAULT 'general',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_meetingminute_group_id_idx ON public.groups_meetingminute(group_id);
CREATE INDEX IF NOT EXISTS groups_message_group_id_idx ON public.groups_message(group_id);
CREATE INDEX IF NOT EXISTS groups_message_recipient_id_idx ON public.groups_message(recipient_id);

ALTER TABLE public.groups_meetingminute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups_message ENABLE ROW LEVEL SECURITY;
