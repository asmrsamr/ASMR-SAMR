import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  cleanString,
  corsHeaders,
  hashClientIp,
  jsonResponse,
  sha256,
} from "../_shared/api-key.ts";

const publicHandler = withSupabase(
  { auth: "none" },
  async (req, ctx) => {
    if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

    let service = cleanString(req.headers.get("x-service-name"), 80);
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
      service = service || cleanString(body.service, 80);
    } catch {
      // The key may be supplied entirely through headers.
    }

    const authorization = req.headers.get("authorization") || "";
    const bearerKey = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7).trim()
      : "";
    const rawKey = cleanString(req.headers.get("x-api-key") || bearerKey || body.api_key, 512);

    if (!rawKey || !rawKey.startsWith("asmr_live_") || !rawKey.includes(".")) {
      return jsonResponse(req, { valid: false, error: "A valid API key is required" }, 401);
    }
    if (!service) return jsonResponse(req, { valid: false, error: "Service name is required" }, 422);

    const keyHash = await sha256(rawKey);
    const { data: key, error } = await ctx.supabaseAdmin
      .from("api_keys")
      .select("id, name, status, permissions, allowed_services, expires_at, owner_id")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error || !key) return jsonResponse(req, { valid: false, error: "API key rejected" }, 401);

    const ipHash = await hashClientIp(req);
    const expired = key.expires_at && new Date(key.expires_at).getTime() <= Date.now();
    const serviceAllowed = key.allowed_services.includes(service) || key.allowed_services.includes("*");
    const active = key.status === "active" && !expired;

    if (!active || !serviceAllowed) {
      if (expired && key.status !== "expired") {
        await ctx.supabaseAdmin.from("api_keys").update({ status: "expired" }).eq("id", key.id);
      }
      await ctx.supabaseAdmin.from("api_key_activity").insert({
        api_key_id: key.id,
        action: "rejected",
        service,
        ip_hash: ipHash,
        metadata: { reason: !active ? "inactive_or_expired" : "service_not_allowed" },
      });
      return jsonResponse(req, { valid: false, error: "API key rejected" }, 403);
    }

    const usedAt = new Date().toISOString();
    const [{ error: updateError }, { error: activityError }] = await Promise.all([
      ctx.supabaseAdmin.from("api_keys").update({ last_used_at: usedAt }).eq("id", key.id),
      ctx.supabaseAdmin.from("api_key_activity").insert({
        api_key_id: key.id,
        action: "used",
        service,
        ip_hash: ipHash,
        metadata: {},
      }),
    ]);
    if (updateError || activityError) {
      return jsonResponse(req, { valid: false, error: "API key verification could not be recorded" }, 503);
    }

    return jsonResponse(req, {
      valid: true,
      key_id: key.id,
      key_name: key.name,
      owner_id: key.owner_id,
      permissions: key.permissions,
      service,
      verified_at: usedAt,
    });
  },
);

export default {
  fetch(req: Request): Response | Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    return publicHandler(req);
  },
};
