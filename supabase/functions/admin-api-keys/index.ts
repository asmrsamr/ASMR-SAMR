import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  cleanString,
  cleanStringArray,
  corsHeaders,
  createRawApiKey,
  hashClientIp,
  jsonResponse,
  maskApiKey,
  safeIsoDate,
  sha256,
} from "../_shared/api-key.ts";

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (req, ctx) => {
    if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

    const actorId = ctx.userClaims?.id || ctx.jwtClaims?.sub;
    if (!actorId) return jsonResponse(req, { error: "Authentication required" }, 401);

    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, status")
      .eq("id", actorId)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin" || profile.status !== "active") {
      return jsonResponse(req, { error: "Administrator access required" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "A JSON request body is required" }, 400);
    }

    const action = cleanString(body.action, 32);
    const ipHash = await hashClientIp(req);

    const logActivity = async (
      apiKeyId: string | null,
      activityAction: string,
      metadata: Record<string, unknown> = {},
      service: string | null = null,
    ) => {
      const { error } = await ctx.supabaseAdmin.from("api_key_activity").insert({
        api_key_id: apiKeyId,
        action: activityAction,
        service,
        actor_id: actorId,
        ip_hash: ipHash,
        metadata,
      });
      if (error) throw error;
    };

    const getKey = async (id: string) => {
      const { data, error } = await ctx.supabaseAdmin
        .from("api_keys")
        .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, last_used_at, rotated_at, revoked_at, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("API key not found");
      return data;
    };

    try {
      if (action === "list") {
        const search = cleanString(body.search, 100);
        const status = cleanString(body.status, 24);
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(body.page_size) || 20));
        const start = (page - 1) * pageSize;

        let query = ctx.supabaseAdmin
          .from("api_keys")
          .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, last_used_at, rotated_at, revoked_at, created_at, updated_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(start, start + pageSize - 1);
        if (search) query = query.ilike("name", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
        if (["active", "inactive", "revoked", "expired"].includes(status)) query = query.eq("status", status);

        const { data, error, count } = await query;
        if (error) throw error;

        const ownerIds = Array.from(new Set((data || []).map((item) => item.owner_id).filter(Boolean)));
        const { data: owners, error: ownersError } = ownerIds.length
          ? await ctx.supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ownerIds)
          : { data: [], error: null };
        if (ownersError) throw ownersError;
        const ownerMap = new Map((owners || []).map((owner) => [owner.id, owner]));

        return jsonResponse(req, {
          data: (data || []).map((key) => ({
            ...key,
            masked_key: maskApiKey(key.key_prefix, key.key_last_four),
            owner: ownerMap.get(key.owner_id) || null,
            effective_status: key.expires_at && new Date(key.expires_at).getTime() <= Date.now()
              ? "expired"
              : key.status,
          })),
          page,
          page_size: pageSize,
          total: count || 0,
        });
      }

      if (action === "activity") {
        const keyId = cleanString(body.id, 80);
        const page = Math.max(1, Number(body.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(body.page_size) || 30));
        const start = (page - 1) * pageSize;
        let query = ctx.supabaseAdmin
          .from("api_key_activity")
          .select("id, api_key_id, action, service, actor_id, metadata, created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(start, start + pageSize - 1);
        if (keyId) query = query.eq("api_key_id", keyId);
        const { data, error, count } = await query;
        if (error) throw error;
        return jsonResponse(req, { data: data || [], page, page_size: pageSize, total: count || 0 });
      }

      if (action === "create") {
        const name = cleanString(body.name, 120);
        const permissions = cleanStringArray(body.permissions);
        const allowedServices = cleanStringArray(body.allowed_services);
        const expiresAt = safeIsoDate(body.expires_at);
        if (!name) return jsonResponse(req, { error: "Key name is required" }, 422);
        if (!permissions.length) return jsonResponse(req, { error: "Select at least one permission" }, 422);
        if (!allowedServices.length) return jsonResponse(req, { error: "Select at least one allowed service" }, 422);

        const generated = createRawApiKey();
        const keyHash = await sha256(generated.rawKey);
        const { data, error } = await ctx.supabaseAdmin
          .from("api_keys")
          .insert({
            name,
            key_prefix: generated.keyPrefix,
            key_last_four: generated.keyLastFour,
            key_hash: keyHash,
            status: "active",
            permissions,
            allowed_services: allowedServices,
            expires_at: expiresAt,
            owner_id: actorId,
          })
          .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, created_at")
          .single();
        if (error) throw error;
        await logActivity(data.id, "created", { name, permissions, allowed_services: allowedServices });
        return jsonResponse(req, {
          data: { ...data, masked_key: maskApiKey(data.key_prefix, data.key_last_four) },
          raw_key: generated.rawKey,
          notice: "This key is shown once. Store it in your service secret manager now.",
        }, 201);
      }

      const id = cleanString(body.id, 80);
      if (!id) return jsonResponse(req, { error: "API key id is required" }, 422);
      const existing = await getKey(id);

      if (action === "update") {
        if (existing.status === "revoked") return jsonResponse(req, { error: "Revoked keys cannot be edited" }, 409);
        const name = cleanString(body.name, 120) || existing.name;
        const permissions = body.permissions === undefined ? existing.permissions : cleanStringArray(body.permissions);
        const allowedServices = body.allowed_services === undefined
          ? existing.allowed_services
          : cleanStringArray(body.allowed_services);
        const status = cleanString(body.status, 24) || existing.status;
        if (!["active", "inactive"].includes(status)) return jsonResponse(req, { error: "Status must be active or inactive" }, 422);
        if (!permissions.length || !allowedServices.length) {
          return jsonResponse(req, { error: "Permissions and allowed services cannot be empty" }, 422);
        }
        const expiresAt = body.expires_at === undefined ? existing.expires_at : safeIsoDate(body.expires_at);
        const { data, error } = await ctx.supabaseAdmin
          .from("api_keys")
          .update({ name, permissions, allowed_services: allowedServices, expires_at: expiresAt, status })
          .eq("id", id)
          .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, last_used_at, created_at, updated_at")
          .single();
        if (error) throw error;
        await logActivity(id, status !== existing.status ? (status === "active" ? "activated" : "deactivated") : "updated", {
          name,
          permissions,
          allowed_services: allowedServices,
        });
        return jsonResponse(req, { data: { ...data, masked_key: maskApiKey(data.key_prefix, data.key_last_four) } });
      }

      if (action === "rotate") {
        if (existing.status === "revoked") return jsonResponse(req, { error: "Revoked keys cannot be rotated" }, 409);
        const generated = createRawApiKey();
        const keyHash = await sha256(generated.rawKey);
        const { data, error } = await ctx.supabaseAdmin
          .from("api_keys")
          .update({
            key_prefix: generated.keyPrefix,
            key_last_four: generated.keyLastFour,
            key_hash: keyHash,
            status: "active",
            rotated_at: new Date().toISOString(),
            revoked_at: null,
          })
          .eq("id", id)
          .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, last_used_at, rotated_at, created_at, updated_at")
          .single();
        if (error) throw error;
        await logActivity(id, "rotated", { previous_prefix: existing.key_prefix, new_prefix: generated.keyPrefix });
        return jsonResponse(req, {
          data: { ...data, masked_key: maskApiKey(data.key_prefix, data.key_last_four) },
          raw_key: generated.rawKey,
          notice: "The previous key stopped working immediately. This replacement is shown once.",
        });
      }

      if (action === "revoke") {
        if (existing.status === "revoked") return jsonResponse(req, { data: existing });
        const { data, error } = await ctx.supabaseAdmin
          .from("api_keys")
          .update({ status: "revoked", revoked_at: new Date().toISOString() })
          .eq("id", id)
          .select("id, name, key_prefix, key_last_four, status, permissions, allowed_services, expires_at, owner_id, last_used_at, revoked_at, created_at, updated_at")
          .single();
        if (error) throw error;
        await logActivity(id, "revoked", { name: existing.name, prefix: existing.key_prefix });
        return jsonResponse(req, { data: { ...data, masked_key: maskApiKey(data.key_prefix, data.key_last_four) } });
      }

      if (action === "delete") {
        if (existing.status !== "revoked") return jsonResponse(req, { error: "Only revoked keys can be deleted" }, 409);
        await logActivity(id, "deleted", { name: existing.name, prefix: existing.key_prefix });
        const { error } = await ctx.supabaseAdmin.from("api_keys").delete().eq("id", id);
        if (error) throw error;
        return jsonResponse(req, { deleted: true, id });
      }

      return jsonResponse(req, { error: "Unknown action" }, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : "API key operation failed";
      return jsonResponse(req, { error: message }, 400);
    }
  },
);

export default {
  fetch(req: Request): Response | Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    return authenticatedHandler(req);
  },
};
