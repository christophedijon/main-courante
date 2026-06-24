import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://maincourante21.bolt.host",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ALLOWED_HOSTS = new Set(["api.zapsis.com", "zapsisweb.com", "billetterie.zapsis.fr"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require authenticated session
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized: missing Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return json({ error: "Unauthorized: invalid token" }, 401);
  }

  // Extract and validate target URL
  const url = new URL(req.url);
  const targetUrlParam = url.searchParams.get("url");

  if (!targetUrlParam) {
    return json({ error: "Missing 'url' parameter" }, 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(targetUrlParam);
  } catch {
    return json({ error: "Invalid URL format" }, 400);
  }

  // Enforce HTTPS
  if (targetUrl.protocol !== "https:") {
    return json({ error: "Only HTTPS URLs allowed" }, 403);
  }

  // Allowlist check
  const hostname = targetUrl.hostname.toLowerCase();
  const isAllowed = Array.from(ALLOWED_HOSTS).some(
    (host) => hostname === host || hostname.endsWith("." + host)
  );

  if (!isAllowed) {
    return json({ error: "Host not allowed" }, 403);
  }

  // Fetch ZAPSIS
  try {
    const response = await fetch(targetUrl.toString(), {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[billetterie-proxy] upstream returned ${response.status}`);
      return json({ error: "External service returned an error" }, 502);
    }

    const data = await response.json();
    return json(data, 200);
  } catch (err) {
    console.error("Fetch error:", err);
    return json({ error: "Failed to reach ZAPSIS endpoint" }, 500);
  }
});
