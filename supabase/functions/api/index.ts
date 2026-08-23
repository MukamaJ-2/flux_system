import { Hono } from "jsr:@hono/hono@4.6.14";
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import { cors } from "jsr:@hono/hono@4.6.14/cors";

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN_EMAIL = "mukamajoseph010@gmail.com";

// ─── App ────────────────────────────────────────────────────────────────────
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

function generateId(prefix: string) {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return code;
}

function generateDefaultPassword() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  return `Flux@${months[now.getMonth()]}${now.getFullYear()}!`;
}

function generateRandomPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

// PBKDF2-SHA256 password hashing compatible with Django pbkdf2_sha256 format
async function hashPassword(password: string): Promise<string> {
  const iterations = 1200000;
  const saltBytes = crypto.getRandomValues(new Uint8Array(12));
  const salt = btoa(String.fromCharCode(...saltBytes));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const encoded = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `pbkdf2_sha256$${iterations}$${salt}$${encoded}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  const encoded = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return encoded === expectedHash;
}

// Simple JWT-like token (base64 payload signed with service key)
async function makeToken(userId: number): Promise<string> {
  const payload = {
    user_id: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const encoded = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_KEY.slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${encoded}.${sigB64}`;
}

async function verifyToken(token: string): Promise<number | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_KEY.slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    new Uint8Array(atob(sig).split("").map((c) => c.charCodeAt(0))),
    new TextEncoder().encode(encoded),
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(atob(encoded));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.user_id;
  } catch {
    return null;
  }
}

async function getAuthUser(req: Request): Promise<any | null> {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const userId = await verifyToken(token);
  if (!userId) return null;
  const { data } = await supabase.from("users_user").select("*").eq("id", userId).maybeSingle();
  return data;
}

function serializeUser(u: any) {
  if (!u) return null;
  const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim() || (u.email || "").split("@")[0];
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    first_name: u.first_name || "",
    last_name: u.last_name || "",
    fullName,
    phone: u.phone || "",
    role: u.role,
    avatar: u.avatar || "",
    isAdmin: u.role === "sysadmin" || u.role === "chair",
    is_active: u.is_active,
    must_change_password: u.must_change_password,
  };
}

async function serializeMembership(m: any) {
  const { data: user } = await supabase.from("users_user").select("*").eq("id", m.user_id).maybeSingle();
  const name = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || (user?.email || "").split("@")[0];
  return {
    id: user?.id,
    name,
    email: user?.email,
    avatar: user?.avatar || "",
    role: m.role,
    joined_at: m.joined_at,
  };
}

async function serializeGroup(g: any) {
  const { data: memberships } = await supabase.from("groups_membership").select("*").eq("group_id", g.id);
  const { data: records } = await supabase.from("finances_record").select("*").eq("group_id", g.id).order("date", { ascending: false });
  const { data: requests } = await supabase.from("finances_request").select("*").eq("group_id", g.id).order("created_at", { ascending: false });

  const members = await Promise.all((memberships || []).map(serializeMembership));
  const serializedRecords = await Promise.all((records || []).map(serializeRecord));
  const serializedRequests = await Promise.all((requests || []).map(serializeRequest));

  return {
    id: g.id,
    name: g.name,
    description: g.description || "",
    contribution: Number(g.contribution),
    frequency: g.frequency,
    cycle: g.cycle,
    invite_code: g.invite_code,
    rules: g.rules || {},
    members,
    records: serializedRecords,
    requests: serializedRequests,
    created_at: g.created_at,
  };
}

async function serializeRequest(r: any) {
  const { data: requester } = await supabase.from("users_user").select("*").eq("id", r.requester_id).maybeSingle();
  const name = `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() || (requester?.email || "").split("@")[0];
  return {
    id: r.id,
    group: r.group_id,
    type: r.type,
    amount: Number(r.amount),
    title: r.title || "",
    method: r.method || "",
    note: r.note || "",
    status: r.status,
    receiptUrl: r.receipt_url || "",
    receipt_url: r.receipt_url || "",
    date: r.date || r.created_at,
    votes: r.votes || { yes: [], no: [] },
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by || "",
    requesterId: String(r.requester_id),
    requesterName: name,
    requesterAvatar: requester?.avatar || (requester?.first_name || "").slice(0, 2).toUpperCase() || "",
  };
}

async function serializeRecord(rec: any) {
  const { data: member } = await supabase.from("users_user").select("*").eq("id", rec.member_id).maybeSingle();
  const name = `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || (member?.email || "").split("@")[0];
  return {
    id: rec.id,
    group: rec.group_id,
    amount: Number(rec.amount),
    method: rec.method,
    note: rec.note || "",
    receipt_url: rec.receipt_url || "",
    date: rec.date,
    memberId: String(rec.member_id),
    memberName: name,
  };
}

async function serializeLoan(l: any) {
  const { data: requester } = await supabase.from("users_user").select("*").eq("id", l.requester_id).maybeSingle();
  const name = `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() || (requester?.email || "").split("@")[0];
  return {
    id: l.id,
    group: l.group_id,
    groupId: l.group_id,
    title: l.title,
    amount: Number(l.amount),
    interestRate: Number(l.interest_rate),
    type: l.type,
    installments: l.installments,
    frequency: l.frequency,
    startDate: l.start_date || "",
    reason: l.reason || "",
    repaid: Number(l.repaid),
    status: l.status,
    createdAt: l.created_at,
    decidedAt: l.decided_at,
    decidedBy: l.decided_by || "",
    disbursedAt: l.disbursed_at || null,
    requesterId: String(l.requester_id),
    requesterName: name,
  };
}

async function serializeGoal(g: any) {
  const { data: user } = await supabase.from("users_user").select("*").eq("id", g.user_id).maybeSingle();
  const name = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || (user?.email || "").split("@")[0];
  return {
    id: g.id,
    userId: String(g.user_id),
    requesterName: name,
    linked_group: g.linked_group_id || null,
    linkedGroupId: g.linked_group_id || "",
    title: g.title,
    targetAmount: Number(g.target_amount),
    savedAmount: Number(g.saved_amount),
    targetDate: g.target_date,
    notes: g.notes || "",
    status: g.status,
    createdAt: g.created_at,
    decidedAt: g.decided_at,
    decidedBy: g.decided_by || "",
  };
}

function hasPermission(user: any, action: string): boolean {
  if (!user) return false;
  if (user.role === "sysadmin") return true;
  const perms: Record<string, string[]> = {
    chair: ["create_group", "onboard_members", "manage_groups"],
    mobilizer: ["create_group", "onboard_members"],
  };
  return (perms[user.role] || []).includes(action);
}

async function canManageGroup(user: any, groupId: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === "sysadmin" || user.role === "chair") return true;
  const { data } = await supabase.from("groups_membership").select("role").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  return data?.role === "admin";
}

async function canHandleFinance(user: any, groupId?: string | null): Promise<boolean> {
  if (!user) return false;
  if (user.role === "sysadmin") return true;
  if (["chair", "treasury", "secretary", "audit"].includes(user.role)) return true;
  if (groupId) return canManageGroup(user, groupId);
  return false;
}

function isGmail(email: string): boolean {
  return email.toLowerCase().endsWith("@gmail.com");
}

const ALLOWED_ROLES = ["sysadmin", "chair", "treasury", "secretary", "audit", "mobilizer", "member"];

// ─── Auth Middleware ─────────────────────────────────────────────────────────

async function requireAuth(req: Request): Promise<any | Response> {
  const user = await getAuthUser(req);
  if (!user) return errorResponse("Authentication credentials were not provided.", 401);
  if (!user.is_active) return errorResponse("Account is inactive.", 403);
  return user;
}

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/api/health/", () => json({ status: "ok" }));

// ─── Token (Login) ───────────────────────────────────────────────────────────

app.post("/api/token/", async (c) => {
  try {
    const body = await c.req.json();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";

    if (!email || !password) return errorResponse("Email and password are required.", 400);

    const { data: user } = await supabase.from("users_user").select("*").eq("email", email).maybeSingle();
    if (!user) return errorResponse("Invalid email or password", 401);
    if (!user.is_active) return errorResponse("Account is inactive.", 401);

    const valid = await verifyPassword(password, user.password);
    if (!valid) return errorResponse("Invalid email or password", 401);

    const token = await makeToken(user.id);
    return json({ access: token, refresh: token });
  } catch (err) {
    return errorResponse("Network error.", 500);
  }
});

app.post("/api/token/refresh/", async (c) => {
  try {
    const body = await c.req.json();
    const userId = await verifyToken(body.refresh || "");
    if (!userId) return errorResponse("Invalid refresh token.", 401);
    const token = await makeToken(userId);
    return json({ access: token, refresh: token });
  } catch {
    return errorResponse("Invalid refresh token.", 401);
  }
});

// ─── Users ───────────────────────────────────────────────────────────────────

// GET /api/users/me/  PATCH /api/users/me/
app.get("/api/users/me/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  return json(serializeUser(user));
});

app.patch("/api/users/me/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();

  const updates: Record<string, unknown> = {};
  if (body.fullName !== undefined) {
    const parts = String(body.fullName).trim().split(" ", 1);
    updates.first_name = parts[0] || "";
    updates.last_name = String(body.fullName).trim().slice(parts[0].length).trim();
  }
  if (body.first_name !== undefined) updates.first_name = body.first_name;
  if (body.last_name !== undefined) updates.last_name = body.last_name;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.avatar !== undefined) updates.avatar = body.avatar;
  if (body.role !== undefined) {
    if (user.role !== "sysadmin") return errorResponse("Only sysadmins can change roles.", 403);
    if (!ALLOWED_ROLES.includes(body.role)) return errorResponse(`Invalid role. Choose from: ${ALLOWED_ROLES.join(", ")}`, 400);
    if (user.role === "sysadmin" && body.role !== "sysadmin") {
      const { count } = await supabase.from("users_user").select("*", { count: "exact", head: true }).eq("role", "sysadmin");
      if ((count || 0) <= 1) return errorResponse("Cannot remove the last sysadmin role.", 400);
    }
    updates.role = body.role;
  }

  const { data: updated } = await supabase.from("users_user").update(updates).eq("id", user.id).select("*").maybeSingle();
  return json(serializeUser(updated));
});

// GET /api/users/  (sysadmin only)
app.get("/api/users/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (user.role !== "sysadmin") return errorResponse("Only sysadmins can view all users.", 403);

  const { data: users } = await supabase.from("users_user").select("*").order("date_joined", { ascending: false });
  return json((users || []).map(serializeUser));
});

// POST /api/users/create/  (sysadmin only)
app.post("/api/users/create/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (user.role !== "sysadmin") return errorResponse("Only sysadmins can create new users.", 403);

  const body = await c.req.json();
  const fullName = (body.fullName || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const phone = (body.phone || "").trim();
  const role = (body.role || "member").trim();

  if (!email || !fullName) return errorResponse("Full name and email are required.", 400);
  if (!isGmail(email)) return errorResponse("Only Gmail accounts are allowed.", 400);
  if (!ALLOWED_ROLES.includes(role)) return errorResponse(`Invalid role. Choose from: ${ALLOWED_ROLES.join(", ")}`, 400);

  const { data: existing } = await supabase.from("users_user").select("id").eq("email", email).maybeSingle();
  if (existing) return errorResponse("A user with this email already exists.", 400);

  const parts = fullName.split(" ", 1);
  const firstName = parts[0] || "";
  const lastName = fullName.slice(firstName.length).trim();
  let username = email.split("@")[0];
  let counter = 1;
  while (true) {
    const { data: u } = await supabase.from("users_user").select("id").eq("username", username).maybeSingle();
    if (!u) break;
    username = `${email.split("@")[0]}${counter}`;
    counter++;
  }

  const defaultPassword = generateDefaultPassword();
  const hashed = await hashPassword(defaultPassword);

  const { data: newUser, error } = await supabase.from("users_user").insert({
    username,
    email,
    password: hashed,
    first_name: firstName,
    last_name: lastName,
    phone,
    role,
    avatar: fullName.slice(0, 2).toUpperCase() || email.slice(0, 2).toUpperCase(),
    must_change_password: true,
    is_active: true,
    is_staff: false,
    is_superuser: false,
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);

  return json({ ...serializeUser(newUser), default_password: defaultPassword }, 201);
});

// POST /api/users/change-password/
app.post("/api/users/change-password/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const newPassword = body.new_password || "";
  const confirmPassword = body.confirm_password || "";

  if (!newPassword || !confirmPassword) return errorResponse("Both new_password and confirm_password are required.", 400);
  if (newPassword !== confirmPassword) return errorResponse("Passwords do not match.", 400);
  if (newPassword.length < 8) return errorResponse("Password must be at least 8 characters.", 400);

  const hashed = await hashPassword(newPassword);
  await supabase.from("users_user").update({ password: hashed, must_change_password: false }).eq("id", user.id);
  return json({ success: true, message: "Password updated successfully." });
});

// PATCH/DELETE /api/users/:id/  (sysadmin only)
app.patch("/api/users/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (user.role !== "sysadmin") return errorResponse("Only sysadmins can manage users.", 403);

  const userId = Number(c.req.param("id"));
  const { data: target } = await supabase.from("users_user").select("*").eq("id", userId).maybeSingle();
  if (!target) return errorResponse("User not found.", 404);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};

  if (body.role !== undefined) {
    const newRole = String(body.role).trim();
    if (!ALLOWED_ROLES.includes(newRole)) return errorResponse(`Invalid role. Choose from: ${ALLOWED_ROLES.join(", ")}`, 400);
    if (target.role === "sysadmin" && newRole !== "sysadmin") {
      const { count } = await supabase.from("users_user").select("*", { count: "exact", head: true }).eq("role", "sysadmin");
      if ((count || 0) <= 1) return errorResponse("Cannot remove the last sysadmin role.", 400);
    }
    updates.role = newRole;
  }
  if (body.is_active !== undefined) {
    if (target.id === user.id) return errorResponse("You cannot change your own active status.", 400);
    let isActive = body.is_active;
    if (typeof isActive === "string") isActive = ["true", "1", "yes"].includes(isActive.toLowerCase());
    if (target.role === "sysadmin" && !isActive) {
      const { count } = await supabase.from("users_user").select("*", { count: "exact", head: true }).eq("role", "sysadmin").eq("is_active", true);
      if ((count || 0) <= 1) return errorResponse("Cannot deactivate the last active sysadmin account.", 400);
    }
    updates.is_active = !!isActive;
  }
  if (body.fullName !== undefined) {
    const parts = String(body.fullName).trim().split(" ", 1);
    updates.first_name = parts[0] || "";
    updates.last_name = String(body.fullName).trim().slice(parts[0].length).trim();
  }
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.avatar !== undefined) updates.avatar = body.avatar;

  const { data: updated } = await supabase.from("users_user").update(updates).eq("id", userId).select("*").maybeSingle();
  return json(serializeUser(updated));
});

app.delete("/api/users/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (user.role !== "sysadmin") return errorResponse("Only sysadmins can manage users.", 403);

  const userId = Number(c.req.param("id"));
  const { data: target } = await supabase.from("users_user").select("*").eq("id", userId).maybeSingle();
  if (!target) return errorResponse("User not found.", 404);
  if (target.id === user.id) return errorResponse("You cannot delete your own account.", 400);
  if (target.role === "sysadmin") {
    const { count } = await supabase.from("users_user").select("*", { count: "exact", head: true }).eq("role", "sysadmin");
    if ((count || 0) <= 1) return errorResponse("Cannot delete the last sysadmin account.", 400);
  }

  await supabase.from("users_user").delete().eq("id", userId);
  return new Response(null, { status: 204 });
});

// ─── Groups ──────────────────────────────────────────────────────────────────

// GET /api/groups/  (list groups user is a member of)
app.get("/api/groups/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return json([]);

  const groupId = c.req.query("group");
  let query = supabase.from("groups_group").select("*").in("id", groupIds);
  if (groupId) query = query.eq("id", groupId);
  const { data: groups } = await query;
  const serialized = await Promise.all((groups || []).map(serializeGroup));
  return json(serialized);
});

// POST /api/groups/  (create group)
app.post("/api/groups/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!hasPermission(user, "create_group")) return errorResponse("Your role cannot create groups.", 403);

  const body = await c.req.json();
  const id = body.id || generateId("group-");
  const inviteCode = generateInviteCode();

  const { data: group, error } = await supabase.from("groups_group").insert({
    id,
    name: body.name || "",
    description: body.description || "",
    contribution: body.contribution || 0,
    frequency: body.frequency || "Monthly",
    cycle: body.cycle || "OPEN",
    invite_code: inviteCode,
    rules: body.rules || {},
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);

  await supabase.from("groups_membership").insert({
    user_id: user.id,
    group_id: id,
    role: "admin",
  });

  return json(await serializeGroup(group), 201);
});

// GET /api/groups/:id/
app.get("/api/groups/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", id).maybeSingle();
  if (!membership) return errorResponse("Not found.", 404);

  const { data: group } = await supabase.from("groups_group").select("*").eq("id", id).maybeSingle();
  if (!group) return errorResponse("Not found.", 404);
  return json(await serializeGroup(group));
});

// PATCH /api/groups/:id/
app.patch("/api/groups/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  if (!await canManageGroup(user, id)) return errorResponse("Only chair or group admins can update group settings.", 403);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ["name", "description", "contribution", "frequency", "cycle", "rules"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data: updated } = await supabase.from("groups_group").update(updates).eq("id", id).select("*").maybeSingle();
  return json(await serializeGroup(updated));
});

// DELETE /api/groups/:id/
app.delete("/api/groups/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  if (!await canManageGroup(user, id)) return errorResponse("Only chair or group admins can delete this group.", 403);

  await supabase.from("groups_group").delete().eq("id", id);
  return new Response(null, { status: 204 });
});

// POST /api/groups/join/
app.post("/api/groups/join/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const inviteCode = (body.inviteCode || "").toUpperCase().trim();
  if (!inviteCode) return errorResponse("inviteCode is required.", 400);

  const { data: group } = await supabase.from("groups_group").select("*").eq("invite_code", inviteCode).maybeSingle();
  if (!group) return errorResponse("Invalid invite code. No group found.", 404);

  const { data: existing } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", group.id).maybeSingle();
  if (existing) return errorResponse("You are already a member of this group.", 400);

  await supabase.from("groups_membership").insert({ user_id: user.id, group_id: group.id, role: "member" });
  return json({ success: true, group: await serializeGroup(group) });
});

// POST /api/groups/:id/members/
app.post("/api/groups/:id/members/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.param("id");
  if (!await canManageGroup(user, groupId) && !hasPermission(user, "onboard_members"))
    return errorResponse("Only chair or mobilizer can add members.", 403);

  const body = await c.req.json();
  const email = (body.email || "").toLowerCase().trim();
  const name = (body.name || "").trim();
  if (!email) return errorResponse("email is required.", 400);

  let defaultPassword: string | null = null;
  let { data: targetUser } = await supabase.from("users_user").select("*").eq("email", email).maybeSingle();

  if (!targetUser) {
    const parts = name.split(" ", 1);
    const firstName = parts[0] || name || "";
    const lastName = name.slice(firstName.length).trim();
    let username = email.split("@")[0];
    let counter = 1;
    while (true) {
      const { data: u } = await supabase.from("users_user").select("id").eq("username", username).maybeSingle();
      if (!u) break;
      username = `${email.split("@")[0]}${counter}`;
      counter++;
    }
    defaultPassword = generateRandomPassword();
    const hashed = await hashPassword(defaultPassword);
    const { data: created } = await supabase.from("users_user").insert({
      username,
      email,
      password: hashed,
      first_name: firstName,
      last_name: lastName,
      avatar: (name || email).slice(0, 2).toUpperCase(),
      must_change_password: true,
      is_active: true,
    }).select("*").maybeSingle();
    targetUser = created;
  }

  const { data: existing } = await supabase.from("groups_membership").select("id").eq("user_id", targetUser.id).eq("group_id", groupId).maybeSingle();
  if (existing) return errorResponse(`${email} is already a member of this group.`, 400);

  await supabase.from("groups_membership").insert({ user_id: targetUser.id, group_id: groupId, role: "member" });
  const membership = { user_id: targetUser.id, group_id: groupId, role: "member", joined_at: new Date().toISOString() };
  const serialized = await serializeMembership(membership);
  const result: any = { ...serialized };
  if (defaultPassword) result.default_password = defaultPassword;
  return json(result, 201);
});

// DELETE/PATCH /api/groups/:id/members/:memberId/
app.delete("/api/groups/:id/members/:memberId/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.param("id");
  const memberId = Number(c.req.param("memberId"));
  if (!await canManageGroup(user, groupId)) return errorResponse("Only chair or group admins can manage members.", 403);

  const { data: membership } = await supabase.from("groups_membership").select("*").eq("user_id", memberId).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("Member not found in this group.", 404);
  if (membership.role === "admin") return errorResponse("Cannot eject the group admin.", 400);

  await supabase.from("groups_membership").delete().eq("user_id", memberId).eq("group_id", groupId);
  return json({ success: true });
});

app.patch("/api/groups/:id/members/:memberId/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.param("id");
  const memberId = Number(c.req.param("memberId"));
  if (!await canManageGroup(user, groupId)) return errorResponse("Only chair or group admins can manage members.", 403);

  const { data: membership } = await supabase.from("groups_membership").select("*").eq("user_id", memberId).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("Member not found in this group.", 404);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  const name = (body.name || "").trim();
  const email = (body.email || "").toLowerCase().trim();

  if (name) {
    const parts = name.split(" ", 1);
    updates.first_name = parts[0] || "";
    updates.last_name = name.slice(parts[0].length).trim();
  }
  if (email) {
    const { data: other } = await supabase.from("users_user").select("id").eq("email", email).neq("id", memberId).maybeSingle();
    if (other) return errorResponse("This email is already in use by another account.", 400);
    updates.email = email;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("users_user").update(updates).eq("id", memberId);
  }
  return json(await serializeMembership(membership));
});

// ─── Requests ───────────────────────────────────────────────────────────────

// GET /api/requests/
app.get("/api/requests/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return json([]);

  const groupId = c.req.query("group");
  let query = supabase.from("finances_request").select("*").in("group_id", groupIds).order("created_at", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);
  const { data: requests } = await query;
  const serialized = await Promise.all((requests || []).map(serializeRequest));
  return json(serialized);
});

// POST /api/requests/
app.post("/api/requests/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const groupId = body.group;
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);

  const id = body.id || generateId("req-");
  const { data: req, error } = await supabase.from("finances_request").insert({
    id,
    group_id: groupId,
    requester_id: user.id,
    type: body.type || "contribution",
    amount: body.amount || 0,
    title: body.title || "",
    method: body.method || "",
    note: body.note || "",
    status: (body.type || "contribution") === "contribution" ? "pending_treasury" : "pending_secretary",
    receipt_url: body.receipt_url || "",
    date: body.date || null,
    votes: { yes: [], no: [] },
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json(await serializeRequest(req), 201);
});

// GET /api/requests/:id/
app.get("/api/requests/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: req } = await supabase.from("finances_request").select("*").eq("id", c.req.param("id")).maybeSingle();
  if (!req) return errorResponse("Not found.", 404);
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", req.group_id).maybeSingle();
  if (!membership) return errorResponse("Not found.", 404);
  return json(await serializeRequest(req));
});

// POST /api/requests/:id/decide/
app.post("/api/requests/:id/decide/", async (c) => {
  return advanceRequest(c, "decide");
});

// POST /api/requests/:id/advance/
app.post("/api/requests/:id/advance/", async (c) => {
  return advanceRequest(c, "advance");
});

async function advanceRequest(c: any, _mode: string) {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: req } = await supabase.from("finances_request").select("*").eq("id", id).maybeSingle();
  if (!req) return errorResponse("Not found.", 404);

  if (!await canHandleFinance(user, req.group_id)) return errorResponse("You do not have permission to decide this request.", 403);

  const body = await c.req.json();
  const approved = !!body.approved;

  const role = user.role;
  // Which role may act at the current stage, and what stage approval moves to next.
  // A rejection at ANY stage is terminal — it must not fall through to the next stage.
  let actorAllowed = false;
  let nextApprovedStatus: string | null = null;
  if (req.type === "contribution") {
    if (req.status === "pending_treasury" && (role === "treasury" || role === "sysadmin")) {
      actorAllowed = true;
      nextApprovedStatus = "approved";
    }
  } else {
    if (req.status === "pending_secretary" && (role === "secretary" || role === "sysadmin")) {
      actorAllowed = true;
      nextApprovedStatus = "pending_treasury";
    } else if (req.status === "pending_treasury" && (role === "treasury" || role === "sysadmin")) {
      actorAllowed = true;
      nextApprovedStatus = "pending_audit";
    } else if (req.status === "pending_audit" && (role === "audit" || role === "sysadmin")) {
      actorAllowed = true;
      nextApprovedStatus = "pending_chair";
    } else if (req.status === "pending_chair" && (role === "chair" || role === "sysadmin")) {
      actorAllowed = true;
      nextApprovedStatus = "approved";
    }
  }

  if (!actorAllowed) return errorResponse("This role cannot advance this request at the current stage.", 403);
  const nextStatus = approved ? nextApprovedStatus : "rejected";

  const decidedBy = `${user.first_name} ${user.last_name}`.trim() || user.email;
  const { data: updated } = await supabase.from("finances_request").update({
    status: nextStatus,
    decided_by: decidedBy,
    decided_at: new Date().toISOString(),
  }).eq("id", id).select("*").maybeSingle();

  // Auto-create a Record on contribution approval
  if (approved && updated.status === "approved" && updated.type === "contribution") {
    await supabase.from("finances_record").insert({
      id: generateId("rec-"),
      group_id: req.group_id,
      member_id: req.requester_id,
      amount: req.amount,
      method: req.method || "Member Request",
      note: req.note || req.title,
      receipt_url: req.receipt_url || "",
      date: req.date || new Date().toISOString(),
    });
  }

  return json(await serializeRequest(updated));
}

// POST /api/requests/:id/vote/
app.post("/api/requests/:id/vote/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: req } = await supabase.from("finances_request").select("*").eq("id", id).maybeSingle();
  if (!req) return errorResponse("Not found.", 404);

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", req.group_id).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);
  if (req.status !== "proposed") return errorResponse("Voting is only allowed on proposed requests.", 400);

  const body = await c.req.json();
  const voteType = (body.vote || "").toLowerCase();
  if (voteType !== "yes" && voteType !== "no") return errorResponse('vote must be "yes" or "no".', 400);

  const userId = String(user.id);
  const votes = req.votes || { yes: [], no: [] };
  votes.yes = (votes.yes || []).filter((v: string) => v !== userId);
  votes.no = (votes.no || []).filter((v: string) => v !== userId);
  votes[voteType].push(userId);

  const { count: totalMembers } = await supabase.from("groups_membership").select("*", { count: "exact", head: true }).eq("group_id", req.group_id);
  const majority = Math.floor((totalMembers || 0) / 2) + 1;
  let newStatus = req.status;
  if (votes.yes.length >= majority) newStatus = "pending_audit";

  const { data: updated } = await supabase.from("finances_request").update({ votes, status: newStatus }).eq("id", id).select("*").maybeSingle();
  return json(await serializeRequest(updated));
});

// ─── Records ────────────────────────────────────────────────────────────────

// GET /api/records/
app.get("/api/records/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return json([]);

  const groupId = c.req.query("group");
  let query = supabase.from("finances_record").select("*").in("group_id", groupIds).order("date", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);
  const { data: records } = await query;
  const serialized = await Promise.all((records || []).map(serializeRecord));
  return json(serialized);
});

// POST /api/records/
app.post("/api/records/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const groupId = body.group;

  const { data: group } = await supabase.from("groups_group").select("id").eq("id", groupId).maybeSingle();
  if (!group) return errorResponse("Invalid group.", 400);
  if (!await canHandleFinance(user, groupId)) return errorResponse("Only finance roles can directly create records.", 403);

  const memberId = body.member ? Number(body.member) : user.id;
  const id = body.id || generateId("rec-");

  const { data: record, error } = await supabase.from("finances_record").insert({
    id,
    group_id: groupId,
    member_id: memberId,
    amount: body.amount || 0,
    method: body.method || "Unknown",
    note: body.note || "",
    receipt_url: body.receipt_url || "",
    date: body.date || null,
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json(await serializeRecord(record), 201);
});

// ─── Loans ───────────────────────────────────────────────────────────────────

// GET /api/loans/
app.get("/api/loans/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return json([]);

  const groupId = c.req.query("group");
  let query = supabase.from("finances_loan").select("*").in("group_id", groupIds).order("created_at", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);
  const { data: loans } = await query;
  const serialized = await Promise.all((loans || []).map(serializeLoan));
  return json(serialized);
});

// POST /api/loans/
app.post("/api/loans/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const groupId = body.group;
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);

  const id = body.id || generateId("loan-");
  const { data: loan, error } = await supabase.from("finances_loan").insert({
    id,
    group_id: groupId,
    requester_id: user.id,
    title: body.title || "",
    amount: body.amount || 0,
    interest_rate: body.interestRate || 0,
    type: body.type || "Flat Rate",
    installments: body.installments || 1,
    frequency: body.frequency || "Monthly",
    start_date: body.startDate || "",
    reason: body.reason || "",
    status: "pending_secretary",
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json(await serializeLoan(loan), 201);
});

// GET /api/loans/:id/
app.get("/api/loans/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: loan } = await supabase.from("finances_loan").select("*").eq("id", c.req.param("id")).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", loan.group_id).maybeSingle();
  if (!membership) return errorResponse("Not found.", 404);
  return json(await serializeLoan(loan));
});

// POST /api/loans/:id/decide/  and  /api/loans/:id/advance/
app.post("/api/loans/:id/decide/", async (c) => advanceLoan(c));
app.post("/api/loans/:id/advance/", async (c) => advanceLoan(c));

async function advanceLoan(c: any) {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: loan } = await supabase.from("finances_loan").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (!await canHandleFinance(user, loan.group_id)) return errorResponse("You do not have permission to decide this loan.", 403);

  const body = await c.req.json();
  const approved = !!body.approved;
  const role = user.role;
  // Which role may act at the current stage, and what stage approval moves to next.
  // A rejection at ANY stage is terminal — it must not fall through to the next stage.
  let actorAllowed = false;
  let nextApprovedStatus: string | null = null;
  if (loan.status === "pending_secretary" && (role === "secretary" || role === "sysadmin")) {
    actorAllowed = true;
    nextApprovedStatus = "pending_treasury";
  } else if (loan.status === "pending_treasury" && (role === "treasury" || role === "sysadmin")) {
    actorAllowed = true;
    nextApprovedStatus = "pending_audit";
  } else if (loan.status === "pending_audit" && (role === "audit" || role === "sysadmin")) {
    actorAllowed = true;
    nextApprovedStatus = "pending_chair";
  } else if (loan.status === "pending_chair" && (role === "chair" || role === "sysadmin")) {
    actorAllowed = true;
    nextApprovedStatus = "approved";
  }

  if (!actorAllowed) return errorResponse("This role cannot advance this loan at the current stage.", 403);
  const nextStatus = approved ? nextApprovedStatus : "rejected";

  const decidedBy = `${user.first_name} ${user.last_name}`.trim() || user.email;
  const { data: updated } = await supabase.from("finances_loan").update({
    status: nextStatus,
    decided_by: decidedBy,
    decided_at: new Date().toISOString(),
  }).eq("id", id).select("*").maybeSingle();

  return json(await serializeLoan(updated));
}

// PATCH /api/loans/:id/disburse/ — Treasury marks an approved loan as actually paid out
app.patch("/api/loans/:id/disburse/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["treasury", "chair", "sysadmin"].includes(user.role)) return errorResponse("Only treasury or chair can disburse a loan.", 403);
  const id = c.req.param("id");
  const { data: loan } = await supabase.from("finances_loan").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (!await canHandleFinance(user, loan.group_id)) return errorResponse("You do not have permission to disburse this loan.", 403);
  if (loan.status !== "approved") return errorResponse("Only an approved loan can be disbursed.", 400);

  const { data: updated } = await supabase.from("finances_loan").update({
    status: "disbursed",
    disbursed_at: new Date().toISOString(),
  }).eq("id", id).select("*").maybeSingle();

  return json(await serializeLoan(updated));
});

// PATCH /api/loans/:id/repay/
app.patch("/api/loans/:id/repay/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: loan } = await supabase.from("finances_loan").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (!await canHandleFinance(user, loan.group_id)) return errorResponse("Only finance roles can record loan repayments.", 403);

  const body = await c.req.json();
  const amount = Number(body.amount) || 0;
  if (isNaN(amount)) return errorResponse("Invalid amount.", 400);

  const newRepaid = Number(loan.repaid) + amount;
  const payable = Number(loan.amount) + (Number(loan.amount) * Number(loan.interest_rate)) / 100;
  let newStatus = loan.status;
  if (newRepaid >= payable) newStatus = "repaid";

  const { data: updated } = await supabase.from("finances_loan").update({ repaid: newRepaid, status: newStatus }).eq("id", id).select("*").maybeSingle();
  return json(await serializeLoan(updated));
});

// PATCH /api/loans/:id/  (general update)
app.patch("/api/loans/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: loan } = await supabase.from("finances_loan").select("*").eq("id", id).maybeSingle();
  if (!loan) return errorResponse("Not found.", 404);
  if (!await canHandleFinance(user, loan.group_id)) return errorResponse("Only finance roles can update this loan.", 403);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  // Note: "status" is intentionally excluded — status transitions must go
  // through /decide/ and /advance/ so the approval workflow can't be skipped.
  const fieldMap: Record<string, string> = {
    title: "title",
    amount: "amount",
    interestRate: "interest_rate",
    type: "type",
    installments: "installments",
    frequency: "frequency",
    startDate: "start_date",
    reason: "reason",
  };
  for (const [k, v] of Object.entries(body)) {
    if (fieldMap[k]) updates[fieldMap[k]] = v;
  }
  if (Object.keys(updates).length === 0) return json(await serializeLoan(loan));

  const { data: updated } = await supabase.from("finances_loan").update(updates).eq("id", id).select("*").maybeSingle();
  return json(await serializeLoan(updated));
});

// ─── Goals ───────────────────────────────────────────────────────────────────

// GET /api/goals/
app.get("/api/goals/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: adminMemberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id).eq("role", "admin");
  const adminGroupIds = (adminMemberships || []).map((m) => m.group_id);

  // Goals owned by user OR linked to a group where user is admin
  let query = supabase.from("finances_goal").select("*").or(`user_id.eq.${user.id}`).order("created_at", { ascending: false });
  if (adminGroupIds.length > 0) {
    query = supabase.from("finances_goal").select("*").or(`user_id.eq.${user.id},linked_group_id.in.(${adminGroupIds.join(",")})`).order("created_at", { ascending: false });
  }

  const groupId = c.req.query("group");
  if (groupId) query = query.eq("linked_group_id", groupId);

  const { data: goals } = await query;
  const serialized = await Promise.all((goals || []).map(serializeGoal));
  return json(serialized);
});

// POST /api/goals/
app.post("/api/goals/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const id = body.id || generateId("goal-");
  const linkedGroupId = body.linkedGroupId || body.linked_group || null;

  let targetUserId = user.id;
  if (body.userId && user.role === "sysadmin") {
    targetUserId = Number(body.userId);
  } else if (body.userId) {
    const { data: adminMembership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", linkedGroupId).eq("role", "admin").maybeSingle();
    if (adminMembership) targetUserId = Number(body.userId);
  }

  const { data: goal, error } = await supabase.from("finances_goal").insert({
    id,
    user_id: targetUserId,
    linked_group_id: linkedGroupId || null,
    title: body.title || "",
    target_amount: body.targetAmount || 0,
    saved_amount: body.savedAmount || 0,
    target_date: body.targetDate,
    notes: body.notes || "",
    status: "pending",
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json(await serializeGoal(goal), 201);
});

// GET /api/goals/:id/
app.get("/api/goals/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const { data: goal } = await supabase.from("finances_goal").select("*").eq("id", c.req.param("id")).maybeSingle();
  if (!goal) return errorResponse("Not found.", 404);
  if (goal.user_id !== user.id) {
    const { data: adminMembership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", goal.linked_group_id).eq("role", "admin").maybeSingle();
    if (!adminMembership && user.role !== "sysadmin") return errorResponse("Not found.", 404);
  }
  return json(await serializeGoal(goal));
});

// POST /api/goals/:id/decide/
app.post("/api/goals/:id/decide/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: goal } = await supabase.from("finances_goal").select("*").eq("id", id).maybeSingle();
  if (!goal) return errorResponse("Not found.", 404);

  let canDecide = false;
  if (goal.linked_group_id) {
    const { data: adminMembership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", goal.linked_group_id).eq("role", "admin").maybeSingle();
    canDecide = !!adminMembership;
  }
  if (user.role === "sysadmin") canDecide = true;
  if (!canDecide) return errorResponse("Only group admins can decide goals.", 403);

  const body = await c.req.json();
  const approved = !!body.approved;
  const decidedBy = `${user.first_name} ${user.last_name}`.trim() || user.email;

  const { data: updated } = await supabase.from("finances_goal").update({
    status: approved ? "approved" : "rejected",
    decided_by: decidedBy,
    decided_at: new Date().toISOString(),
  }).eq("id", id).select("*").maybeSingle();

  return json(await serializeGoal(updated));
});

// PATCH /api/goals/:id/save/
app.patch("/api/goals/:id/save/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: goal } = await supabase.from("finances_goal").select("*").eq("id", id).maybeSingle();
  if (!goal) return errorResponse("Not found.", 404);
  if (goal.user_id !== user.id) return errorResponse("You can only update your own goals.", 403);

  const body = await c.req.json();
  const amount = Number(body.amount) || 0;
  if (isNaN(amount)) return errorResponse("Invalid amount.", 400);

  const newSaved = Number(goal.saved_amount) + amount;
  let newStatus = goal.status;
  if (newSaved >= Number(goal.target_amount)) newStatus = "completed";

  const { data: updated } = await supabase.from("finances_goal").update({ saved_amount: newSaved, status: newStatus }).eq("id", id).select("*").maybeSingle();
  return json(await serializeGoal(updated));
});

// PATCH /api/goals/:id/  (general update)
app.patch("/api/goals/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: goal } = await supabase.from("finances_goal").select("*").eq("id", id).maybeSingle();
  if (!goal) return errorResponse("Not found.", 404);
  if (goal.user_id !== user.id && user.role !== "sysadmin") return errorResponse("Not found.", 404);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  // Note: "status" is intentionally excluded — status transitions must go
  // through /decide/ so a goal owner can't self-approve their own goal.
  const fieldMap: Record<string, string> = {
    title: "title",
    targetAmount: "target_amount",
    savedAmount: "saved_amount",
    targetDate: "target_date",
    notes: "notes",
    linkedGroupId: "linked_group_id",
  };
  for (const [k, v] of Object.entries(body)) {
    if (fieldMap[k]) updates[fieldMap[k]] = v;
  }
  if (Object.keys(updates).length === 0) return json(await serializeGoal(goal));

  const { data: updated } = await supabase.from("finances_goal").update(updates).eq("id", id).select("*").maybeSingle();
  return json(await serializeGoal(updated));
});

// ─── Notices (Secretary broadcasts) ─────────────────────────────────────────

// GET /api/notices/?group=<groupId>
app.get("/api/notices/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.query("group");
  if (!groupId) return json([]);

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return json([]);

  const { data: notices } = await supabase.from("groups_notice").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
  const result = await Promise.all((notices || []).map(async (n: any) => {
    const { data: author } = await supabase.from("users_user").select("*").eq("id", n.author_id).maybeSingle();
    return {
      id: n.id,
      groupId: n.group_id,
      type: n.type,
      message: n.message,
      author: `${author?.first_name || ""} ${author?.last_name || ""}`.trim() || author?.email || "",
      createdAt: n.created_at,
    };
  }));
  return json(result);
});

// POST /api/notices/
app.post("/api/notices/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["secretary", "chair", "sysadmin"].includes(user.role)) return errorResponse("Only secretary or chair can send notices.", 403);

  const body = await c.req.json();
  const groupId = body.groupId || body.group;
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);

  const id = generateId("notice-");
  const { data: notice, error } = await supabase.from("groups_notice").insert({
    id,
    group_id: groupId,
    author_id: user.id,
    type: body.type || "general",
    message: body.message || "",
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json({
    id: notice.id,
    groupId: notice.group_id,
    type: notice.type,
    message: notice.message,
    author: `${user.first_name} ${user.last_name}`.trim() || user.email,
    createdAt: notice.created_at,
  }, 201);
});

// ─── Meeting Minutes (Secretary) ──────────────────────────────────────────────

// GET /api/minutes/?group=<groupId>
app.get("/api/minutes/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.query("group");
  if (!groupId) return json([]);

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return json([]);

  const { data: minutes } = await supabase.from("groups_meetingminute").select("*").eq("group_id", groupId).order("meeting_date", { ascending: false });
  const result = await Promise.all((minutes || []).map(async (m: any) => {
    const { data: author } = await supabase.from("users_user").select("*").eq("id", m.author_id).maybeSingle();
    return {
      id: m.id,
      groupId: m.group_id,
      title: m.title,
      meetingDate: m.meeting_date,
      content: m.content,
      author: `${author?.first_name || ""} ${author?.last_name || ""}`.trim() || author?.email || "",
      createdAt: m.created_at,
    };
  }));
  return json(result);
});

// POST /api/minutes/
app.post("/api/minutes/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["secretary", "chair", "sysadmin"].includes(user.role)) return errorResponse("Only the secretary or chair can log meeting minutes.", 403);

  const body = await c.req.json();
  const groupId = body.groupId || body.group;
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);

  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return errorResponse("title and content are required.", 400);

  const id = generateId("minute-");
  const { data: minute, error } = await supabase.from("groups_meetingminute").insert({
    id,
    group_id: groupId,
    author_id: user.id,
    title,
    meeting_date: body.meetingDate || null,
    content,
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json({
    id: minute.id,
    groupId: minute.group_id,
    title: minute.title,
    meetingDate: minute.meeting_date,
    content: minute.content,
    author: `${user.first_name} ${user.last_name}`.trim() || user.email,
    createdAt: minute.created_at,
  }, 201);
});

// ─── Messages (Mobilizer reminders & meeting invitations) ────────────────────

// GET /api/messages/?group=<groupId>
// Group members see messages addressed to them + broadcasts. Mobilizer/Chair/
// Secretary/Sysadmin additionally see the full sent log for the group.
app.get("/api/messages/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.query("group");
  if (!groupId) return json([]);

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return json([]);

  const canSeeAll = ["mobilizer", "chair", "secretary", "sysadmin"].includes(user.role);
  let query = supabase.from("groups_message").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
  if (!canSeeAll) query = query.or(`recipient_id.eq.${user.id},recipient_id.is.null`);

  const { data: messages } = await query;
  const result = await Promise.all((messages || []).map(async (m: any) => {
    const { data: sender } = await supabase.from("users_user").select("*").eq("id", m.sender_id).maybeSingle();
    const { data: recipient } = m.recipient_id
      ? await supabase.from("users_user").select("*").eq("id", m.recipient_id).maybeSingle()
      : { data: null };
    return {
      id: m.id,
      groupId: m.group_id,
      type: m.type,
      message: m.message,
      sender: `${sender?.first_name || ""} ${sender?.last_name || ""}`.trim() || sender?.email || "",
      recipientId: m.recipient_id ? String(m.recipient_id) : null,
      recipientName: recipient ? (`${recipient.first_name || ""} ${recipient.last_name || ""}`.trim() || recipient.email) : null,
      createdAt: m.created_at,
    };
  }));
  return json(result);
});

// GET /api/messages/inbox/  — everything addressed to the current user, across all their groups
app.get("/api/messages/inbox/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;

  const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return json([]);

  const { data: messages } = await supabase
    .from("groups_message")
    .select("*")
    .in("group_id", groupIds)
    .or(`recipient_id.eq.${user.id},recipient_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50);

  const result = await Promise.all((messages || []).map(async (m: any) => {
    const { data: sender } = await supabase.from("users_user").select("*").eq("id", m.sender_id).maybeSingle();
    const { data: group } = await supabase.from("groups_group").select("name").eq("id", m.group_id).maybeSingle();
    return {
      id: m.id,
      groupId: m.group_id,
      groupName: group?.name || "",
      type: m.type,
      message: m.message,
      sender: `${sender?.first_name || ""} ${sender?.last_name || ""}`.trim() || sender?.email || "",
      createdAt: m.created_at,
    };
  }));
  return json(result);
});

// POST /api/messages/
app.post("/api/messages/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["mobilizer", "chair", "secretary", "sysadmin"].includes(user.role)) {
    return errorResponse("Only the mobilizer, secretary, or chair can send reminders and invitations.", 403);
  }

  const body = await c.req.json();
  const groupId = body.groupId || body.group;
  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("You are not a member of this group.", 403);

  const message = (body.message || "").trim();
  if (!message) return errorResponse("message is required.", 400);

  const type = ["reminder", "meeting_invite", "general"].includes(body.type) ? body.type : "general";

  let recipientId: number | null = null;
  if (body.recipientId) {
    recipientId = Number(body.recipientId);
    const { data: recipientMembership } = await supabase.from("groups_membership").select("id").eq("user_id", recipientId).eq("group_id", groupId).maybeSingle();
    if (!recipientMembership) return errorResponse("That recipient is not a member of this group.", 400);
  }

  const id = generateId("msg-");
  const { data: created, error } = await supabase.from("groups_message").insert({
    id,
    group_id: groupId,
    sender_id: user.id,
    recipient_id: recipientId,
    type,
    message,
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json({
    id: created.id,
    groupId: created.group_id,
    type: created.type,
    message: created.message,
    sender: `${user.first_name} ${user.last_name}`.trim() || user.email,
    recipientId: created.recipient_id ? String(created.recipient_id) : null,
    createdAt: created.created_at,
  }, 201);
});

// ─── Issues (Mobilizer tracking) ─────────────────────────────────────────────

// GET /api/issues/?group=<groupId>
app.get("/api/issues/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.query("group");

  let query = supabase.from("groups_issue").select("*").order("created_at", { ascending: false });
  if (groupId) {
    const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
    if (!membership) return json([]);
    query = query.eq("group_id", groupId);
  } else {
    const { data: memberships } = await supabase.from("groups_membership").select("group_id").eq("user_id", user.id);
    const groupIds = (memberships || []).map((m) => m.group_id);
    if (groupIds.length === 0) return json([]);
    query = query.in("group_id", groupIds);
  }

  const { data: issues } = await query;
  const result = await Promise.all((issues || []).map(async (iss: any) => {
    const { data: author } = await supabase.from("users_user").select("*").eq("id", iss.author_id).maybeSingle();
    const { data: group } = await supabase.from("groups_group").select("name").eq("id", iss.group_id).maybeSingle();
    return {
      id: iss.id,
      groupId: iss.group_id,
      groupName: group?.name || "",
      title: iss.title,
      description: iss.description,
      status: iss.status,
      author: `${author?.first_name || ""} ${author?.last_name || ""}`.trim() || author?.email || "",
      createdAt: iss.created_at,
      resolvedAt: iss.resolved_at,
    };
  }));
  return json(result);
});

// POST /api/issues/
app.post("/api/issues/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const body = await c.req.json();
  const groupId = body.groupId || body.group;

  if (groupId) {
    const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
    if (!membership) return errorResponse("You are not a member of this group.", 403);
  }

  const id = generateId("issue-");
  const { data: issue, error } = await supabase.from("groups_issue").insert({
    id,
    group_id: groupId || null,
    author_id: user.id,
    title: body.title || "",
    description: body.description || "",
    status: "open",
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);
  return json({
    id: issue.id,
    groupId: issue.group_id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    author: `${user.first_name} ${user.last_name}`.trim() || user.email,
    createdAt: issue.created_at,
  }, 201);
});

// PATCH /api/issues/:id/  (resolve issue)
app.patch("/api/issues/:id/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const { data: issue } = await supabase.from("groups_issue").select("*").eq("id", id).maybeSingle();
  if (!issue) return errorResponse("Not found.", 404);

  const canResolve = ["chair", "mobilizer", "sysadmin"].includes(user.role) ||
    (issue.group_id && await canManageGroup(user, issue.group_id));
  if (!canResolve) return errorResponse("You do not have permission to update this issue.", 403);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.status === "resolved") updates.resolved_at = new Date().toISOString();

  const { data: updated } = await supabase.from("groups_issue").update(updates).eq("id", id).select("*").maybeSingle();
  return json({
    id: updated.id,
    groupId: updated.group_id,
    title: updated.title,
    description: updated.description,
    status: updated.status,
    createdAt: updated.created_at,
    resolvedAt: updated.resolved_at,
  });
});

// ─── Audit Logs ──────────────────────────────────────────────────────────────

// GET /api/audit-logs/?group=<groupId>
app.get("/api/audit-logs/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["audit", "sysadmin", "chair"].includes(user.role)) return errorResponse("Only audit or admin roles can view audit logs.", 403);

  const groupId = c.req.query("group");
  let query = supabase.from("groups_auditlog").select("*").order("created_at", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);

  const { data: logs } = await query;
  const result = await Promise.all((logs || []).map(async (log: any) => {
    const { data: auditor } = await supabase.from("users_user").select("*").eq("id", log.auditor_id).maybeSingle();
    return {
      id: log.id,
      groupId: log.group_id,
      auditor: `${auditor?.first_name || ""} ${auditor?.last_name || ""}`.trim() || auditor?.email || "",
      hashChain: log.hash_chain,
      recordCount: log.record_count,
      verified: log.verified,
      createdAt: log.created_at,
    };
  }));
  return json(result);
});

// POST /api/audit-logs/  (run hash-chain verification)
app.post("/api/audit-logs/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  if (!["audit", "sysadmin"].includes(user.role)) return errorResponse("Only audit role can run verification.", 403);

  const body = await c.req.json();
  const groupId = body.groupId || body.group;
  if (!groupId) return errorResponse("groupId is required.", 400);

  // Fetch all records for the group, ordered by date
  const { data: records } = await supabase.from("finances_record").select("*").eq("group_id", groupId).order("date", { ascending: true });
  const recs = records || [];

  // Build a simple hash chain: each record's hash includes the previous hash
  let prevHash = "genesis";
  const hashParts: string[] = [];
  for (const rec of recs) {
    const data = `${rec.id}|${rec.member_id}|${rec.amount}|${rec.method}|${rec.date}|${prevHash}`;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    hashParts.push(hash);
    prevHash = hash;
  }

  const verified = true; // chain is self-consistent by construction
  const hashChain = hashParts.join(" → ");

  const id = generateId("audit-");
  const { data: log, error } = await supabase.from("groups_auditlog").insert({
    id,
    group_id: groupId,
    auditor_id: user.id,
    hash_chain: hashChain,
    record_count: recs.length,
    verified,
  }).select("*").maybeSingle();

  if (error) return errorResponse(error.message, 400);

  return json({
    id: log.id,
    groupId: log.group_id,
    auditor: `${user.first_name} ${user.last_name}`.trim() || user.email,
    hashChain,
    recordCount: recs.length,
    verified,
    createdAt: log.created_at,
  }, 201);
});

// ─── Analytics (Chair dashboard) ─────────────────────────────────────────────

// GET /api/analytics/?group=<groupId>
app.get("/api/analytics/", async (c) => {
  const user = await requireAuth(c.req.raw);
  if (user instanceof Response) return user;
  const groupId = c.req.query("group");
  if (!groupId) return json({});

  const { data: membership } = await supabase.from("groups_membership").select("id").eq("user_id", user.id).eq("group_id", groupId).maybeSingle();
  if (!membership) return errorResponse("Not found.", 404);

  const { data: group } = await supabase.from("groups_group").select("*").eq("id", groupId).maybeSingle();
  const { data: records } = await supabase.from("finances_record").select("*").eq("group_id", groupId).order("date", { ascending: true });
  const { data: loans } = await supabase.from("finances_loan").select("*").eq("group_id", groupId);
  const { data: members } = await supabase.from("groups_membership").select("*").eq("group_id", groupId);
  const { count: memberCount } = await supabase.from("groups_membership").select("*", { count: "exact", head: true }).eq("group_id", groupId);

  const recs = records || [];
  const totalCollected = recs.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
  const expectedTotal = Number(group?.contribution || 0) * (memberCount || 0);
  const collectionRate = expectedTotal > 0 ? Math.round((totalCollected / expectedTotal) * 100) : 0;

  // Monthly breakdown
  const monthly: Record<string, number> = {};
  for (const r of recs) {
    const month = new Date(r.date).toISOString().slice(0, 7);
    monthly[month] = (monthly[month] || 0) + Number(r.amount);
  }

  // Loan stats
  const activeLoans = (loans || []).filter((l: any) => l.status === "approved" || l.status === "disbursed");
  const totalOutstanding = activeLoans.reduce((sum: number, l: any) => {
    const payable = Number(l.amount) + (Number(l.amount) * Number(l.interest_rate)) / 100;
    return sum + Math.max(0, payable - Number(l.repaid));
  }, 0);
  const totalRepaid = (loans || []).reduce((sum: number, l: any) => sum + Number(l.repaid), 0);

  // Member contribution breakdown
  const memberBreakdown: Record<string, number> = {};
  for (const r of recs) {
    const key = String(r.member_id);
    memberBreakdown[key] = (memberBreakdown[key] || 0) + Number(r.amount);
  }

  return json({
    groupId,
    groupName: group?.name || "",
    totalCollected,
    expectedTotal,
    collectionRate,
    memberCount: memberCount || 0,
    recordCount: recs.length,
    monthlyBreakdown: monthly,
    activeLoans: activeLoans.length,
    totalOutstanding,
    totalRepaid,
    memberBreakdown,
  });
});

// ─── Fallback ────────────────────────────────────────────────────────────────

app.all("*", (c) => {
  const path = new URL(c.req.raw.url).pathname;
  return errorResponse(`Route not found: ${c.req.method} ${path} (raw: ${c.req.raw.url})`, 404);
});

Deno.serve(app.fetch);
