export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function corsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin") || "";
  const allowOrigin = configured.includes(origin)
    ? origin
    : configured[0] || "http://localhost:8000";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...corsHeaders(req) },
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createRawApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyLastFour: string;
} {
  const prefixBytes = crypto.getRandomValues(new Uint8Array(6));
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const keyPrefix = `asmr_live_${bytesToBase64Url(prefixBytes)}`;
  const secret = bytesToBase64Url(secretBytes);
  return {
    rawKey: `${keyPrefix}.${secret}`,
    keyPrefix,
    keyLastFour: secret.slice(-4),
  };
}

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function maskApiKey(keyPrefix: string, keyLastFour: string): string {
  return `${keyPrefix}.********${keyLastFour}`;
}

export function cleanString(value: unknown, maxLength = 160): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function cleanStringArray(value: unknown, maxItems = 32): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 80))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

export function safeIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Expiration must be an ISO date string");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Expiration date is invalid");
  if (date.getTime() <= Date.now()) throw new Error("Expiration must be in the future");
  return date.toISOString();
}

export async function hashClientIp(req: Request): Promise<string | null> {
  const salt = Deno.env.get("API_KEY_AUDIT_SALT");
  if (!salt) return null;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("cf-connecting-ip") || "";
  return ip ? sha256(`${salt}:${ip}`) : null;
}
