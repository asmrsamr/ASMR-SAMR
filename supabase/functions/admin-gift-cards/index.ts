import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  cleanString,
  corsHeaders,
  jsonResponse,
  safeIsoDate,
  sha256,
} from "../_shared/api-key.ts";

function createGiftCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (value) => alphabet[value % alphabet.length]);
  return `ASMR-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function mask(lastFour: string): string {
  return `ASMR-****-****-${lastFour}`;
}

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  const actorId = ctx.userClaims?.id || ctx.jwtClaims?.sub;
  if (!actorId) return jsonResponse(req, { error: "Authentication required" }, 401);

  const { data: actor, error: actorError } = await ctx.supabaseAdmin
    .from("profiles").select("id, role, status").eq("id", actorId).maybeSingle();
  if (actorError || !actor || actor.status !== "active") {
    return jsonResponse(req, { error: "Authorized finance access required" }, 403);
  }
  let allowed = actor.role === "admin";
  if (!allowed) {
    const { data } = await ctx.supabaseAdmin.from("role_permissions")
      .select("permission").eq("role_name", actor.role).in("permission", ["finance.write", "finance.post"]);
    allowed = Boolean(data?.length);
  }
  if (!allowed) return jsonResponse(req, { error: "Authorized finance access required" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "A JSON request body is required" }, 400);
  }

  const action = cleanString(body.action, 32);
  const log = async (activity: string, id: string | null, metadata: Record<string, unknown>) => {
    const { error } = await ctx.supabaseAdmin.from("audit_logs").insert({
      actor_id: actorId,
      action: activity,
      entity_type: "gift_cards",
      entity_id: id,
      metadata,
    });
    if (error) throw error;
  };

  try {
    if (action === "list") {
      const search = cleanString(body.search, 120);
      const status = cleanString(body.status, 24);
      const page = Math.max(1, Number(body.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(body.page_size) || 20));
      const start = (page - 1) * pageSize;
      let query = ctx.supabaseAdmin.from("gift_cards")
        .select("id, code_last_four, initial_balance, current_balance, currency, status, purchaser_id, recipient_email, expires_at, created_at, updated_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1);
      if (status) query = query.eq("status", status);
      if (search) query = query.or(`recipient_email.ilike.%${search.replaceAll(",", "") }%,code_last_four.ilike.%${search.replaceAll(",", "")}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return jsonResponse(req, {
        data: (data || []).map((card) => ({ ...card, masked_code: mask(card.code_last_four) })),
        page,
        page_size: pageSize,
        total: count || 0,
      });
    }

    if (action === "create") {
      const initialBalance = Number(body.initial_balance);
      const currency = cleanString(body.currency, 3).toUpperCase() || "SAR";
      const recipientEmail = cleanString(body.recipient_email, 254).toLowerCase() || null;
      const purchaserId = cleanString(body.purchaser_id, 80) || null;
      const expiresAt = safeIsoDate(body.expires_at);
      if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
        return jsonResponse(req, { error: "Initial balance must be greater than zero" }, 422);
      }
      if (recipientEmail && !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
        return jsonResponse(req, { error: "Recipient email is invalid" }, 422);
      }
      const rawCode = createGiftCode();
      const codeHash = await sha256(rawCode);
      const lastFour = rawCode.slice(-4);
      const { data, error } = await ctx.supabaseAdmin.from("gift_cards").insert({
        code_hash: codeHash,
        code_last_four: lastFour,
        initial_balance: initialBalance,
        current_balance: initialBalance,
        currency,
        status: "active",
        purchaser_id: purchaserId,
        recipient_email: recipientEmail,
        expires_at: expiresAt,
      }).select("id, code_last_four, initial_balance, current_balance, currency, status, purchaser_id, recipient_email, expires_at, created_at").single();
      if (error) throw error;
      await log("create", data.id, { initial_balance: initialBalance, currency });
      return jsonResponse(req, {
        data: { ...data, masked_code: mask(data.code_last_four) },
        raw_code: rawCode,
        notice: "This gift-card code is shown once. Send it through an approved private channel.",
      }, 201);
    }

    const id = cleanString(body.id, 80);
    if (!id) return jsonResponse(req, { error: "Gift card id is required" }, 422);
    const { data: existing, error: existingError } = await ctx.supabaseAdmin.from("gift_cards")
      .select("id, code_last_four, initial_balance, current_balance, currency, status, purchaser_id, recipient_email, expires_at, created_at")
      .eq("id", id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return jsonResponse(req, { error: "Gift card not found" }, 404);

    if (action === "update") {
      if (existing.status === "revoked") return jsonResponse(req, { error: "Revoked cards cannot be edited" }, 409);
      const status = cleanString(body.status, 24) || existing.status;
      if (!["active", "redeemed", "expired"].includes(status)) return jsonResponse(req, { error: "Invalid status" }, 422);
      const recipientEmail = body.recipient_email === undefined
        ? existing.recipient_email
        : cleanString(body.recipient_email, 254).toLowerCase() || null;
      const expiresAt = body.expires_at === undefined ? existing.expires_at : safeIsoDate(body.expires_at);
      const { data, error } = await ctx.supabaseAdmin.from("gift_cards")
        .update({ status, recipient_email: recipientEmail, expires_at: expiresAt })
        .eq("id", id)
        .select("id, code_last_four, initial_balance, current_balance, currency, status, purchaser_id, recipient_email, expires_at, created_at, updated_at")
        .single();
      if (error) throw error;
      await log("update", id, { status, recipient_email: recipientEmail });
      return jsonResponse(req, { data: { ...data, masked_code: mask(data.code_last_four) } });
    }

    if (action === "revoke") {
      const { data, error } = await ctx.supabaseAdmin.from("gift_cards").update({ status: "revoked" })
        .eq("id", id)
        .select("id, code_last_four, initial_balance, current_balance, currency, status, recipient_email, expires_at, created_at, updated_at")
        .single();
      if (error) throw error;
      await log("revoke", id, { previous_status: existing.status });
      return jsonResponse(req, { data: { ...data, masked_code: mask(data.code_last_four) } });
    }

    if (action === "delete") {
      if (existing.status !== "revoked" || Number(existing.current_balance) !== Number(existing.initial_balance)) {
        return jsonResponse(req, { error: "Only unused, revoked gift cards can be deleted" }, 409);
      }
      await log("delete", id, { last_four: existing.code_last_four });
      const { error } = await ctx.supabaseAdmin.from("gift_cards").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse(req, { deleted: true, id });
    }

    return jsonResponse(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gift-card operation failed";
    return jsonResponse(req, { error: message }, 400);
  }
});

export default {
  fetch(req: Request): Response | Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    return handler(req);
  },
};
