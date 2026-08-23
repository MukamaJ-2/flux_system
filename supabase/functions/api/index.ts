import { Hono } from "jsr:@hono/hono@4.6.14";
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import { cors } from "jsr:@hono/hono@4.6.14/cors";

// ─── Config ────────────────────────────────────────────────────────────────
// v2: identity comes from Supabase Auth, not a hand-rolled token. `supabase`
// is the service-role client used for all business-rule writes (it bypasses
// RLS deliberately — the workflow invariants below, like dual loan approval
// or "you can't approve your own contribution," are enforced here in code
// because they don't fit cleanly into a row-level policy). `authClient` is
// used only to verify the caller's bearer token against Supabase Auth.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// The project's dashboard "Site URL" auth setting isn't reliable to depend on
// (it defaults to localhost:3000 and changing it needs dashboard access this
// function doesn't have) — so invite links pass their redirect explicitly
// instead of relying on that project-wide default. Override via the SITE_URL
// secret once a real production URL exists.
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Client-Info", "Apikey"],
  }),
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

const ROLES = ["chair", "treasurer", "secretary", "mobilizer", "auditor"] as const;

async function getAuthUser(req: Request): Promise<any | null> {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return null;

  const { data: roleRows } = await supabase.from("member_roles").select("role").eq("member_id", data.user.id);
  const roles = (roleRows || []).map((r: any) => r.role as string);

  return { ...profile, email: data.user.email, roles };
}

async function requireAuth(req: Request): Promise<any | Response> {
  const user = await getAuthUser(req);
  if (!user) return errorResponse("Authentication credentials were not provided.", 401);
  if (!user.is_active) return errorResponse("Account is inactive.", 403);
  return user;
}

function hasRole(user: any, role: string): boolean {
  return (user.roles || []).includes(role);
}

function hasAnyOversightRole(user: any): boolean {
  return hasRole(user, "treasurer") || hasRole(user, "chair") || hasRole(user, "auditor");
}

async function writeAuditLog(actorId: string, action: string, targetTable: string, targetId: string, before: unknown, after: unknown) {
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    before: before ?? null,
    after: after ?? null,
  });
}

async function serializeProfile(p: any) {
  const { data: roleRows } = await supabase.from("member_roles").select("role").eq("member_id", p.id);
  return {
    id: p.id,
    fullName: p.full_name,
    phone: p.phone,
    avatar: p.avatar,
    isActive: p.is_active,
    joinedAt: p.joined_at,
    roles: (roleRows || []).map((r: any) => r.role),
  };
}

function serializeContribution(c: any) {
  return {
    id: c.id,
    memberId: c.member_id,
    period: c.period,
    amountDue: Number(c.amount_due),
    amountPaid: Number(c.amount_paid),
    status: c.status,
    proofUrl: c.proof_url,
    method: c.method,
    reviewedBy: c.reviewed_by,
    reviewedAt: c.reviewed_at,
    rejectionReason: c.rejection_reason,
    createdAt: c.created_at,
  };
}

function serializeLoan(l: any) {
  return {
    id: l.id,
    borrowerId: l.borrower_id,
    principal: Number(l.principal),
    interestRate: Number(l.interest_rate),
    reason: l.reason,
    installments: l.installments,
    dueDate: l.due_date,
    status: l.status,
    createdAt: l.created_at,
  };
}

function serializeLedgerEntry(e: any) {
  return {
    id: e.id,
    entryType: e.entry_type,
    direction: e.direction,
    amount: Number(e.amount),
    memberId: e.member_id,
    relatedContributionId: e.related_contribution_id,
    relatedLoanId: e.related_loan_id,
    note: e.note,
    createdBy: e.created_by,
    createdAt: e.created_at,
  };
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/api/health/", () => json({ status: "ok" }));

// ─── Me / Profile ────────────────────────────────────────────────────────────

app.get("/api/me/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  return json({
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    avatar: user.avatar,
    isActive: user.is_active,
    roles: user.roles,
  });
});

app.patch("/api/me/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  if (body.fullName !== undefined) updates.full_name = body.fullName;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.avatar !== undefined) updates.avatar = body.avatar;

  const { data: updated } = await supabase.from("profiles").update(updates).eq("id", user.id).select("*").maybeSingle();
  return json(await serializeProfile(updated));
});

// ─── Members (directory + Chair-only management) ────────────────────────────

app.get("/api/members/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: profiles } = await supabase.from("profiles").select("*").order("joined_at", { ascending: false });
  return json(await Promise.all((profiles || []).map(serializeProfile)));
});

// POST /api/members/invite/  (Chair only) — creates the Supabase Auth user
// and returns a one-time set-password link for the Chair to share directly
// (WhatsApp, SMS, in person) instead of routing through Supabase's built-in
// mailer. That mailer is fine for occasional use but rate-limits hard
// (a handful of emails/hour) unless a custom SMTP provider is configured —
// not something to depend on for onboarding a whole group. `handle_new_user`
// still creates the profiles row the moment the auth user is created, same
// as before.
app.post("/api/members/invite/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "chair")) return errorResponse("Only the Chair can invite members.", 403);

  const body = await c.req.json();
  const email = (body.email || "").toLowerCase().trim();
  const fullName = (body.fullName || "").trim();
  const phone = (body.phone || "").trim();
  if (!email || !fullName) return errorResponse("Full name and email are required.", 400);

  const { data: linked, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { full_name: fullName, phone },
      redirectTo: `${SITE_URL}/set-password`,
    },
  });
  if (error) return errorResponse(error.message, 400);

  await writeAuditLog(user.id, "invite_member", "profiles", linked.user!.id, null, { email, fullName });
  return json({ id: linked.user!.id, email, link: linked.properties.action_link }, 201);
});

// PATCH /api/members/:id/roles/  (Chair only) — body: { role, grant: boolean }
app.patch("/api/members/:id/roles/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "chair")) return errorResponse("Only the Chair can assign roles.", 403);

  const memberId = c.req.param("id");
  const body = await c.req.json();
  const role = body.role;
  if (!ROLES.includes(role)) return errorResponse(`Invalid role. Choose from: ${ROLES.join(", ")}`, 400);

  if (body.grant) {
    const { error } = await supabase.from("member_roles").insert({ member_id: memberId, role, assigned_by: user.id });
    if (error && !error.message.includes("duplicate")) return errorResponse(error.message, 400);
    await writeAuditLog(user.id, "grant_role", "member_roles", memberId, null, { role });
  } else {
    await supabase.from("member_roles").delete().eq("member_id", memberId).eq("role", role);
    await writeAuditLog(user.id, "revoke_role", "member_roles", memberId, { role }, null);
  }

  const { data: roleRows } = await supabase.from("member_roles").select("role").eq("member_id", memberId);
  return json({ memberId, roles: (roleRows || []).map((r: any) => r.role) });
});

// PATCH /api/members/:id/active/  (Chair only)
app.patch("/api/members/:id/active/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "chair")) return errorResponse("Only the Chair can activate or deactivate members.", 403);
  if (c.req.param("id") === user.id) return errorResponse("You cannot change your own active status.", 400);

  const body = await c.req.json();
  const { data: updated } = await supabase.from("profiles").update({ is_active: !!body.isActive }).eq("id", c.req.param("id")).select("*").maybeSingle();
  await writeAuditLog(user.id, "set_active", "profiles", c.req.param("id"), null, { isActive: !!body.isActive });
  return json(await serializeProfile(updated));
});

// ─── Group settings ──────────────────────────────────────────────────────────

app.get("/api/settings/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: settings } = await supabase.from("group_settings").select("*").eq("id", true).maybeSingle();
  return json(settings);
});

app.patch("/api/settings/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "chair")) return errorResponse("Only the Chair can change group settings.", 403);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  for (const key of [
    "name", "contribution_amount", "frequency", "contribution_deadline_day", "interest_rate", "interest_type", "cycle_status",
    "min_membership_months", "max_loan_multiple_of_savings", "max_loan_percent_of_fund",
  ]) {
    const camel = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    if (body[camel] !== undefined) updates[key] = body[camel];
  }
  updates.updated_at = new Date().toISOString();

  const { data: updated } = await supabase.from("group_settings").update(updates).eq("id", true).select("*").maybeSingle();
  await writeAuditLog(user.id, "update_settings", "group_settings", "singleton", null, updates);
  return json(updated);
});

// ─── Contributions ───────────────────────────────────────────────────────────

app.get("/api/contributions/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  let query = supabase.from("contributions").select("*").order("period", { ascending: false });
  if (!hasAnyOversightRole(user)) query = query.eq("member_id", user.id);
  const period = c.req.query("period");
  if (period) query = query.eq("period", period);

  const { data: rows } = await query;
  return json((rows || []).map(serializeContribution));
});

// POST /api/contributions/ — log a contribution. A member can submit as
// many of these as they want (no per-period limit) — each is its own row.
app.post("/api/contributions/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const period = body.period; // 'YYYY-MM-01'
  const amountPaid = Number(body.amountPaid) || 0;
  if (!period || amountPaid <= 0) return errorResponse("period and a positive amountPaid are required.", 400);

  const { data: settings } = await supabase.from("group_settings").select("contribution_amount").eq("id", true).maybeSingle();
  const amountDue = Number(settings?.contribution_amount || 0);

  const { data: created, error } = await supabase.from("contributions").insert({
    member_id: user.id,
    period,
    amount_due: amountDue,
    amount_paid: amountPaid,
    proof_url: body.proofUrl || "",
    method: body.method || "",
    status: "pending",
  }).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 400);
  return json(serializeContribution(created), 201);
});

// POST /api/contributions/:id/decide/  (Treasurer/Chair) — body: { approved, reason? }
app.post("/api/contributions/:id/decide/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "treasurer") && !hasRole(user, "chair")) return errorResponse("Only Treasurer or Chair can decide contributions.", 403);

  const id = c.req.param("id");
  const { data: contribution } = await supabase.from("contributions").select("*").eq("id", id).maybeSingle();
  if (!contribution) return errorResponse("Not found.", 404);
  if (contribution.status !== "pending") return errorResponse("This contribution has already been decided.", 400);

  // Separation of duties: a Treasurer cannot approve their own submission.
  // The Chair is the designated escalation path for that case.
  if (contribution.member_id === user.id && !hasRole(user, "chair")) {
    return errorResponse("You cannot approve your own contribution — ask the Chair to review it.", 403);
  }

  const body = await c.req.json();
  const approved = !!body.approved;

  if (!approved) {
    const { data: updated } = await supabase.from("contributions").update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: body.reason || "",
    }).eq("id", id).select("*").maybeSingle();
    await writeAuditLog(user.id, "reject_contribution", "contributions", id, contribution, { reason: body.reason || "" });
    return json(serializeContribution(updated));
  }

  const newStatus = contribution.amount_paid >= contribution.amount_due ? "approved" : "partial";
  const { data: updated } = await supabase.from("contributions").update({
    status: newStatus,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id).select("*").maybeSingle();

  await supabase.from("ledger_entries").insert({
    entry_type: "contribution",
    direction: "credit",
    amount: contribution.amount_paid,
    member_id: contribution.member_id,
    related_contribution_id: id,
    created_by: user.id,
  });
  await writeAuditLog(user.id, "approve_contribution", "contributions", id, contribution, { status: newStatus });

  return json(serializeContribution(updated));
});

// ─── Ledger ──────────────────────────────────────────────────────────────────

app.get("/api/ledger/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  let query = supabase.from("ledger_entries").select("*").order("created_at", { ascending: false });
  const memberId = c.req.query("member");
  if (memberId) query = query.eq("member_id", memberId);
  const { data: rows } = await query;
  return json((rows || []).map(serializeLedgerEntry));
});

app.get("/api/ledger/summary/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: rows } = await supabase.from("ledger_entries").select("*");
  const entries = rows || [];

  let groupTotal = 0;
  const perMember: Record<string, number> = {};
  for (const e of entries) {
    const signed = e.direction === "credit" ? Number(e.amount) : -Number(e.amount);
    groupTotal += signed;
    if (e.member_id) perMember[e.member_id] = (perMember[e.member_id] || 0) + signed;
  }

  return json({ groupTotal, perMember, myTotal: perMember[user.id] || 0 });
});

// ─── Loans ───────────────────────────────────────────────────────────────────

app.get("/api/loans/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  let query = supabase.from("loans").select("*").order("created_at", { ascending: false });
  if (!hasAnyOversightRole(user)) query = query.eq("borrower_id", user.id);
  const { data: rows } = await query;
  return json((rows || []).map(serializeLoan));
});

app.post("/api/loans/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const principal = Number(body.principal) || 0;
  if (principal <= 0) return errorResponse("principal must be positive.", 400);

  const { data: settings } = await supabase.from("group_settings").select("*").eq("id", true).maybeSingle();

  // ── Eligibility (spec §4.2): membership tenure, no outstanding loan,
  // and a cap relative to both the borrower's own savings and the group
  // fund. Thresholds are Chair-configurable in group_settings; defaults
  // are permissive so an unconfigured group isn't suddenly blocked.
  const monthsSinceJoined = (Date.now() - new Date(user.joined_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsSinceJoined < Number(settings?.min_membership_months || 0)) {
    return errorResponse(`You must be a member for at least ${settings?.min_membership_months} month(s) before requesting a loan.`, 400);
  }

  const { data: existingLoans } = await supabase
    .from("loans")
    .select("id")
    .eq("borrower_id", user.id)
    .in("status", ["requested", "pending_second_approval", "approved", "active"]);
  if ((existingLoans || []).length > 0) {
    return errorResponse("You already have an outstanding loan — repay or resolve it before requesting another.", 400);
  }

  const { data: myLedger } = await supabase.from("ledger_entries").select("amount, direction").eq("member_id", user.id);
  const mySavings = (myLedger || []).reduce((s: number, e: any) => s + (e.direction === "credit" ? Number(e.amount) : -Number(e.amount)), 0);
  const maxByMultiple = mySavings * Number(settings?.max_loan_multiple_of_savings ?? 1000);
  if (principal > maxByMultiple) {
    return errorResponse(`Requested amount exceeds ${settings?.max_loan_multiple_of_savings}x your savings (UGX ${Math.max(0, Math.floor(maxByMultiple)).toLocaleString()} max).`, 400);
  }

  const { data: allLedger } = await supabase.from("ledger_entries").select("amount, direction");
  const groupTotal = (allLedger || []).reduce((s: number, e: any) => s + (e.direction === "credit" ? Number(e.amount) : -Number(e.amount)), 0);
  const maxByFundShare = groupTotal * (Number(settings?.max_loan_percent_of_fund ?? 100) / 100);
  if (principal > maxByFundShare) {
    return errorResponse(`Requested amount exceeds ${settings?.max_loan_percent_of_fund}% of the group fund (UGX ${Math.max(0, Math.floor(maxByFundShare)).toLocaleString()} max).`, 400);
  }

  const { data: created, error } = await supabase.from("loans").insert({
    borrower_id: user.id,
    principal,
    interest_rate: settings?.interest_rate || 0,
    reason: body.reason || "",
    installments: body.installments || 1,
    due_date: body.dueDate || null,
    status: "requested",
  }).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 400);
  return json(serializeLoan(created), 201);
});

// POST /api/loans/:id/decide/ (Treasurer/Chair) — dual approval: the loan
// only becomes `active` once two DISTINCT approvers have approved it. A
// single rejection is terminal.
app.post("/api/loans/:id/decide/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "treasurer") && !hasRole(user, "chair")) return errorResponse("Only Treasurer or Chair can decide loans.", 403);

  const id = c.req.param("id");
  const { data: loan } = await supabase.from("loans").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (!["requested", "pending_second_approval"].includes(loan.status)) {
    return errorResponse("This loan has already been decided.", 400);
  }
  if (loan.borrower_id === user.id) return errorResponse("You cannot decide your own loan.", 403);

  const body = await c.req.json();
  const decision = body.approved ? "approved" : "rejected";

  const { error: insertError } = await supabase.from("loan_approvals").insert({ loan_id: id, approver_id: user.id, decision });
  if (insertError) {
    if (insertError.message.includes("duplicate")) return errorResponse("You've already decided on this loan.", 400);
    return errorResponse(insertError.message, 400);
  }

  if (decision === "rejected") {
    const { data: updated } = await supabase.from("loans").update({ status: "rejected" }).eq("id", id).select("*").maybeSingle();
    await writeAuditLog(user.id, "reject_loan", "loans", id, loan, null);
    return json(serializeLoan(updated));
  }

  const { count: approvalCount } = await supabase
    .from("loan_approvals")
    .select("*", { count: "exact", head: true })
    .eq("loan_id", id)
    .eq("decision", "approved");

  let nextStatus = "pending_second_approval";
  if ((approvalCount || 0) >= 2) {
    nextStatus = "active";
    await supabase.from("ledger_entries").insert({
      entry_type: "loan_disbursement",
      direction: "debit",
      amount: loan.principal,
      member_id: loan.borrower_id,
      related_loan_id: id,
      created_by: user.id,
    });
  }

  const { data: updated } = await supabase.from("loans").update({ status: nextStatus }).eq("id", id).select("*").maybeSingle();
  await writeAuditLog(user.id, "approve_loan", "loans", id, loan, { status: nextStatus });
  return json(serializeLoan(updated));
});

// PATCH /api/loans/:id/repay/
app.patch("/api/loans/:id/repay/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: loan } = await supabase.from("loans").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (loan.borrower_id !== user.id && !hasAnyOversightRole(user)) return errorResponse("You do not have permission to repay this loan.", 403);
  if (loan.status !== "active") return errorResponse("Only an active loan can be repaid.", 400);

  const body = await c.req.json();
  const amount = Number(body.amount) || 0;
  if (amount <= 0) return errorResponse("Invalid amount.", 400);

  await supabase.from("ledger_entries").insert({
    entry_type: "loan_repayment",
    direction: "credit",
    amount,
    member_id: loan.borrower_id,
    related_loan_id: id,
    created_by: user.id,
  });

  const { data: repayments } = await supabase.from("ledger_entries").select("amount").eq("related_loan_id", id).eq("entry_type", "loan_repayment");
  const totalRepaid = (repayments || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const payable = Number(loan.principal) + (Number(loan.principal) * Number(loan.interest_rate)) / 100;

  let updated = loan;
  if (totalRepaid >= payable) {
    const { data: r } = await supabase.from("loans").update({ status: "repaid" }).eq("id", id).select("*").maybeSingle();
    updated = r;
  }
  return json({ ...serializeLoan(updated), totalRepaid });
});

// ─── Investments ─────────────────────────────────────────────────────────────

function serializeInvestment(i: any) {
  return {
    id: i.id,
    description: i.description,
    amount: Number(i.amount),
    expectedReturn: i.expected_return !== null ? Number(i.expected_return) : null,
    actualReturn: i.actual_return !== null ? Number(i.actual_return) : null,
    investedAt: i.invested_at,
    returnedAt: i.returned_at,
    status: i.status,
    createdBy: i.created_by,
    createdAt: i.created_at,
  };
}

app.get("/api/investments/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: rows } = await supabase.from("investments").select("*").order("invested_at", { ascending: false });
  return json((rows || []).map(serializeInvestment));
});

app.post("/api/investments/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "treasurer") && !hasRole(user, "chair")) return errorResponse("Only Treasurer or Chair can log investments.", 403);

  const body = await c.req.json();
  const description = (body.description || "").trim();
  const amount = Number(body.amount) || 0;
  if (!description || amount <= 0) return errorResponse("description and a positive amount are required.", 400);

  const { data: created, error } = await supabase.from("investments").insert({
    description,
    amount,
    expected_return: body.expectedReturn ? Number(body.expectedReturn) : null,
    invested_at: body.investedAt || new Date().toISOString().split("T")[0],
    created_by: user.id,
  }).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 400);

  await writeAuditLog(user.id, "log_investment", "investments", created.id, null, { description, amount });
  return json(serializeInvestment(created), 201);
});

// PATCH /api/investments/:id/return/ — record the actual return and post the
// profit to the ledger as group income (no member_id — it's a group gain).
app.patch("/api/investments/:id/return/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "treasurer") && !hasRole(user, "chair")) return errorResponse("Only Treasurer or Chair can record a return.", 403);

  const id = c.req.param("id");
  const { data: investment } = await supabase.from("investments").select("*").eq("id", id).maybeSingle();
  if (!investment) return errorResponse("Not found.", 404);
  if (investment.status === "returned") return errorResponse("This investment has already been marked returned.", 400);

  const body = await c.req.json();
  const actualReturn = Number(body.actualReturn);
  if (isNaN(actualReturn) || actualReturn < 0) return errorResponse("actualReturn must be a non-negative number.", 400);

  const { data: updated } = await supabase.from("investments").update({
    actual_return: actualReturn,
    returned_at: new Date().toISOString(),
    status: "returned",
  }).eq("id", id).select("*").maybeSingle();

  const profit = actualReturn - Number(investment.amount);
  if (profit > 0) {
    await supabase.from("ledger_entries").insert({
      entry_type: "interest_income",
      direction: "credit",
      amount: profit,
      note: `Return on investment: ${investment.description}`,
      created_by: user.id,
    });
  } else if (profit < 0) {
    await supabase.from("ledger_entries").insert({
      entry_type: "interest_income",
      direction: "debit",
      amount: Math.abs(profit),
      note: `Loss on investment: ${investment.description}`,
      created_by: user.id,
    });
  }

  await writeAuditLog(user.id, "record_investment_return", "investments", id, investment, { actualReturn });
  return json(serializeInvestment(updated));
});

// ─── Meetings & Attendance ───────────────────────────────────────────────────

app.get("/api/meetings/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: rows } = await supabase.from("meetings").select("*").order("meeting_date", { ascending: false });
  return json((rows || []).map((m: any) => ({
    id: m.id,
    meetingDate: m.meeting_date,
    minutes: m.minutes,
    recordedBy: m.recorded_by,
    createdAt: m.created_at,
  })));
});

app.post("/api/meetings/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "secretary") && !hasRole(user, "chair")) return errorResponse("Only Secretary or Chair can log meeting minutes.", 403);

  const body = await c.req.json();
  const { data: created, error } = await supabase.from("meetings").insert({
    meeting_date: body.meetingDate,
    minutes: body.minutes || "",
    recorded_by: user.id,
  }).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 400);
  return json({ id: created.id, meetingDate: created.meeting_date, minutes: created.minutes, createdAt: created.created_at }, 201);
});

app.get("/api/meetings/:id/attendance/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: rows } = await supabase.from("attendance").select("member_id").eq("meeting_id", c.req.param("id"));
  return json((rows || []).map((r: any) => r.member_id));
});

app.post("/api/meetings/:id/attendance/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "secretary") && !hasRole(user, "chair")) return errorResponse("Only Secretary or Chair can record attendance.", 403);

  const meetingId = c.req.param("id");
  const body = await c.req.json();
  const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
  const rows = memberIds.map((memberId) => ({ meeting_id: meetingId, member_id: memberId }));
  if (rows.length > 0) await supabase.from("attendance").upsert(rows, { onConflict: "meeting_id,member_id" });

  return json({ success: true, count: rows.length });
});

// ─── Goals ───────────────────────────────────────────────────────────────────

app.get("/api/goals/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  let query = supabase.from("goals").select("*").order("created_at", { ascending: false });
  if (!hasRole(user, "chair")) query = query.eq("member_id", user.id);
  const { data: rows } = await query;
  return json((rows || []).map((g: any) => ({
    id: g.id,
    memberId: g.member_id,
    title: g.title,
    targetAmount: Number(g.target_amount),
    savedAmount: Number(g.saved_amount),
    targetDate: g.target_date,
    notes: g.notes,
    status: g.status,
    createdAt: g.created_at,
  })));
});

app.post("/api/goals/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const { data: created, error } = await supabase.from("goals").insert({
    member_id: user.id,
    title: body.title || "",
    target_amount: body.targetAmount || 0,
    target_date: body.targetDate || null,
    notes: body.notes || "",
    status: "pending",
  }).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 400);
  return json(created, 201);
});

// ─── Notifications ───────────────────────────────────────────────────────────

app.get("/api/notifications/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  let query = supabase.from("notifications").select("*").order("sent_at", { ascending: false }).limit(50);
  if (!hasRole(user, "mobilizer") && !hasRole(user, "secretary") && !hasRole(user, "chair")) {
    query = query.eq("member_id", user.id);
  }
  const { data: rows } = await query;
  return json(rows || []);
});

// POST /api/notifications/ — body: { type, message, memberIds?: [] } —
// omit memberIds to broadcast to every active member.
app.post("/api/notifications/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "mobilizer") && !hasRole(user, "secretary") && !hasRole(user, "chair")) {
    return errorResponse("Only Mobilizer, Secretary, or Chair can send notifications.", 403);
  }

  const body = await c.req.json();
  let memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
  if (memberIds.length === 0) {
    const { data: active } = await supabase.from("profiles").select("id").eq("is_active", true);
    memberIds = (active || []).map((p: any) => p.id);
  }

  const rows = memberIds.map((memberId) => ({
    type: body.type || "general",
    member_id: memberId,
    channel: "app",
    payload: body.message || "",
  }));
  if (rows.length > 0) await supabase.from("notifications").insert(rows);

  return json({ success: true, count: rows.length }, 201);
});

// ─── Audit Log ───────────────────────────────────────────────────────────────

app.get("/api/audit-log/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasRole(user, "chair") && !hasRole(user, "auditor")) return errorResponse("Only Chair or Auditor can view the audit log.", 403);

  const { data: rows } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  return json(rows || []);
});

// ─── Fallback ────────────────────────────────────────────────────────────────

app.all("*", (c) => {
  const path = new URL(c.req.raw.url).pathname;
  return errorResponse(`Route not found: ${c.req.method} ${path}`, 404);
});

Deno.serve(app.fetch);
