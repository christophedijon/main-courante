import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return jsonResp({ error: "Unauthorized" }, 401);

    const { data: adminRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("email", caller.email!)
      .maybeSingle();

    if (!adminRow) return jsonResp({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      if (!authUsers?.users) return jsonResp({ orphans: [] });

      const { data: managedIds } = await adminClient
        .from("managed_users")
        .select("auth_user_id");

      const { data: superAdminEmails } = await adminClient
        .from("super_admins")
        .select("email");

      const managedSet = new Set((managedIds ?? []).map((r: { auth_user_id: string | null }) => r.auth_user_id));
      const saEmails = new Set((superAdminEmails ?? []).map((r: { email: string }) => r.email.toLowerCase()));

      const orphans = authUsers.users
        .filter((u) => !managedSet.has(u.id) && !saEmails.has((u.email ?? "").toLowerCase()))
        .map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));

      return jsonResp({ orphans });
    }

    if (action === "delete") {
      const ids: string[] = body.user_ids ?? [];
      if (ids.length === 0) return jsonResp({ error: "Missing user_ids" }, 400);

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const id of ids) {
        const { error } = await adminClient.auth.admin.deleteUser(id);
        if (error) {
          failed.push({ id, error: error.message });
        } else {
          deleted.push(id);
        }
      }

      return jsonResp({ deleted, failed });
    }

    return jsonResp({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[clean-orphan-auth] error:", err);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
