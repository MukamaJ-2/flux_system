/*
# Contribution proof-of-payment storage

1. Summary
Adds a private Storage bucket for proof-of-payment photos (mobile money
screenshots, receipts) attached to a contribution submission. Objects are
stored under `{member_id}/...` — a member can only write into their own
folder, and can read their own; Treasurer/Chair can read everyone's, so
reviewers can actually see what they're approving.

2. Security
- Bucket is private (`public = false`) — files are only reachable via a
  signed URL generated on demand (`createSignedUrl`), never a public link.
- Reuses `public.has_role()` from the Phase 1 migration rather than
  redefining role-check logic here.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY proofs_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY proofs_select_own_or_oversight ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_any_oversight_role()
    )
  );
