import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  cleanString,
  cleanStringArray,
  corsHeaders,
  jsonResponse,
} from "../_shared/api-key.ts";

const roles = new Set([
  "customer",
  "admin",
  "manager",
  "finance",
  "marketing",
  "inventory",
  "production",
  "support",
]);
const statuses = new Set(["invited", "active", "inactive", "suspended"]);
const tiers = new Set(["ivory", "amber", "signature"]);

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const actorId = ctx.userClaims?.id || ctx.jwtClaims?.sub;
  if (!actorId) return jsonResponse(req, { error: "Authentication required" }, 401);

  const { data: actor, error: actorError } = await ctx.supabaseAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError || !actor || actor.role !== "admin" || actor.status !== "active") {
    return jsonResponse(req, { error: "Administrator access required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "A JSON request body is required" }, 400);
  }

  const action = cleanString(body.action, 32);
  const userId = cleanString(body.id, 80);
  const log = async (activity: string, targetId: string | null, metadata: Record<string, unknown>) => {
    const { error } = await ctx.supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action: activity,
      entity_type: "profiles",
      entity_id: targetId,
      metadata,
    });
    if (error) throw error;
  };

  try {
    if (action === "invite") {
      const email = cleanString(body.email, 254).toLowerCase();
      const fullName = cleanString(body.full_name, 160);
      const phone = cleanString(body.phone, 40) || null;
      const role = cleanString(body.role, 32) || "customer";
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return jsonResponse(req, { error: "A valid email is required" }, 422);
      }
      if (!roles.has(role)) return jsonResponse(req, { error: "Invalid role" }, 422);

      const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL") || undefined;
      const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      });
      if (error) throw error;
      const invitedId = data.user?.id;
      if (!invitedId) throw new Error("Supabase did not return the invited user");

      const { error: profileError } = await ctx.supabaseAdmin.from("profiles").upsert({
        id: invitedId,
        email,
        full_name: fullName || null,
        phone,
        role,
        status: "invited",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (profileError) throw profileError;
      await log("invite", invitedId, { role });
      return jsonResponse(req, { data: { id: invitedId, email, full_name: fullName, phone, role, status: "invited" } }, 201);
    }

    if (!userId) return jsonResponse(req, { error: "User id is required" }, 422);
    if (userId === actorId && ["suspend", "deactivate", "anonymize"].includes(action)) {
      return jsonResponse(req, { error: "You cannot disable your own administrator account" }, 409);
    }

    const { data: existing, error: existingError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, phone, role, status, membership_tier, points, notes, tags")
      .eq("id", userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return jsonResponse(req, { error: "User not found" }, 404);

    const protectAdminContinuity = async (nextRole: string, nextStatus: string) => {
      if (existing.role !== "admin" || (nextRole === "admin" && nextStatus === "active")) {
        return null;
      }
      if (userId === actorId) {
        return jsonResponse(req, {
          error: "You cannot disable or demote your own administrator account",
        }, 409);
      }
      const { count, error } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "active")
        .is("anonymized_at", null)
        .neq("id", userId);
      if (error) throw error;
      if (!count) {
        return jsonResponse(req, {
          error: "At least one active administrator must remain",
        }, 409);
      }
      return null;
    };

    if (action === "update") {
      const role = cleanString(body.role, 32) || existing.role;
      const status = cleanString(body.status, 32) || existing.status;
      const tier = cleanString(body.membership_tier, 32) || existing.membership_tier;
      if (!roles.has(role) || !statuses.has(status) || !tiers.has(tier)) {
        return jsonResponse(req, { error: "Invalid role, status, or membership tier" }, 422);
      }
      const continuityError = await protectAdminContinuity(role, status);
      if (continuityError) return continuityError;
      const email = body.email === undefined ? existing.email : cleanString(body.email, 254).toLowerCase();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return jsonResponse(req, { error: "Email is invalid" }, 422);
      const fullName = body.full_name === undefined ? existing.full_name : cleanString(body.full_name, 160) || null;
      const phone = body.phone === undefined ? existing.phone : cleanString(body.phone, 40) || null;
      const notes = body.notes === undefined ? existing.notes : cleanString(body.notes, 3000) || null;
      const tags = body.tags === undefined ? existing.tags : cleanStringArray(body.tags, 32);

      const authPatch: Record<string, unknown> = {};
      if (email && email !== existing.email) authPatch.email = email;
      if (phone !== existing.phone) authPatch.phone = phone || "";
      if (Object.keys(authPatch).length) {
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(userId, authPatch);
        if (error) throw error;
      }
      const { data, error } = await ctx.supabaseAdmin.from("profiles").update({
        email: email || null,
        full_name: fullName,
        phone,
        role,
        status,
        membership_tier: tier,
        notes,
        tags,
        updated_at: new Date().toISOString(),
      }).eq("id", userId)
        .select("id, email, full_name, phone, role, status, membership_tier, points, notes, tags, updated_at")
        .single();
      if (error) throw error;
      await log("update", userId, { role, status, membership_tier: tier });
      return jsonResponse(req, { data });
    }

    if (["activate", "deactivate", "suspend"].includes(action)) {
      const status = action === "activate" ? "active" : action === "suspend" ? "suspended" : "inactive";
      const continuityError = await protectAdminContinuity(existing.role, status);
      if (continuityError) return continuityError;
      const banDuration = status === "active" ? "none" : "876000h";
      const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
      if (authError) throw authError;
      const { data, error } = await ctx.supabaseAdmin.from("profiles")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .select("id, email, full_name, role, status, membership_tier, points, updated_at")
        .single();
      if (error) throw error;
      await log(action, userId, { previous_status: existing.status, status });
      return jsonResponse(req, { data });
    }

    if (action === "password_reset") {
      if (!existing.email) return jsonResponse(req, { error: "This account has no email address" }, 409);
      const redirectTo = Deno.env.get("PASSWORD_RESET_REDIRECT_URL") || undefined;
      const { error } = await ctx.supabaseAdmin.auth.resetPasswordForEmail(existing.email, { redirectTo });
      if (error) throw error;
      await log("password_reset_requested", userId, {});
      return jsonResponse(req, { sent: true });
    }

    if (action === "anonymize") {
      const reason = cleanString(body.reason, 500);
      if (!reason) return jsonResponse(req, { error: "An anonymization reason is required" }, 422);
      const continuityError = await protectAdminContinuity("customer", "anonymized");
      if (continuityError) return continuityError;
      await log("anonymize", userId, { reason, previous_role: existing.role });
      const { error: profileError } = await ctx.supabaseAdmin.from("profiles").update({
        full_name: "Anonymized user",
        email: null,
        phone: null,
        city: null,
        address: null,
        preference: null,
        notes: null,
        tags: [],
        consent: {},
        role: "customer",
        status: "anonymized",
        anonymized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (profileError) throw profileError;
      const { error: addressError } = await ctx.supabaseAdmin.from("user_addresses").delete().eq("user_id", userId);
      if (addressError) throw addressError;
      const { error: authError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId, true);
      if (authError) throw authError;
      return jsonResponse(req, { anonymized: true, id: userId });
    }

    return jsonResponse(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "User operation failed";
    return jsonResponse(req, { error: message }, 400);
  }
});

export default {
  fetch(req: Request): Response | Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    return handler(req);
  },
};
