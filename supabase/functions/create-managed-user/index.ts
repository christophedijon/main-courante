import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://maincourante21.bolt.host",
  "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Guard: called before any DELETE or PATCH.
// operatorIsSuperAdmin = true  → full access, no hierarchy check.
// operatorFonction = "Direction" → cannot touch other Directions or super-admins.
async function assertCanModify(
  adminClient: ReturnType<typeof createClient>,
  targetAuthUserId: string,
  operatorIsSuperAdmin: boolean,
  operatorFonction: string | null,
) {
  if (operatorIsSuperAdmin) return; // super-admins can modify anyone

  // Resolve target email to check if they are a super-admin
  const { data: { user: targetAuthUser } } = await adminClient.auth.admin.getUserById(targetAuthUserId);
  if (!targetAuthUser) {
    throw new Error("Target user not found");
  }

  const { data: targetSuperAdmin } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("email", targetAuthUser.email!)
    .maybeSingle();

  if (targetSuperAdmin) {
    throw new Error("Forbidden: cannot modify a super-admin");
  }

  // Resolve target's fonction in managed_users
  const { data: targetManaged } = await adminClient
    .from("managed_users")
    .select("fonction")
    .eq("auth_user_id", targetAuthUserId)
    .maybeSingle();

  if (!targetManaged) {
    throw new Error("Target user not found in managed_users");
  }

  // Direction cannot modify another Direction
  if (operatorFonction === "Direction" && targetManaged.fonction === "Direction") {
    throw new Error("Forbidden: Direction cannot modify other Directors");
  }
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
    if (!authHeader) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    // Check super_admins OR Direction
    const { data: adminRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("email", caller.email!)
      .maybeSingle();

    const { data: managedRow } = await adminClient
      .from("managed_users")
      .select("fonction")
      .eq("auth_user_id", caller.id)
      .maybeSingle();

    const isSuperAdmin = !!adminRow;
    const operatorFonction = managedRow?.fonction ?? null;
    const isAuthorized = isSuperAdmin || operatorFonction === "Direction";

    if (!isAuthorized) {
      return jsonResp({ error: "Forbidden" }, 403);
    }

    // ── DELETE ────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { auth_user_id } = await req.json();
      if (!auth_user_id) {
        return jsonResp({ error: "Missing auth_user_id" }, 400);
      }

      await assertCanModify(adminClient, auth_user_id, isSuperAdmin, operatorFonction);

      const { error: delErr } = await adminClient.auth.admin.deleteUser(auth_user_id);
      if (delErr) {
        return jsonResp({ error: delErr.message }, 400);
      }
      return jsonResp({ success: true });
    }

    // ── PATCH (update email and/or password) ──────────────────────
    if (req.method === "PATCH") {
      const { auth_user_id, email, password } = await req.json();
      if (!auth_user_id) {
        return jsonResp({ error: "Missing auth_user_id" }, 400);
      }

      await assertCanModify(adminClient, auth_user_id, isSuperAdmin, operatorFonction);

      const updates: Record<string, string> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;

      if (Object.keys(updates).length === 0) {
        return jsonResp({ error: "Nothing to update" }, 400);
      }

      const { error: updateErr } = await adminClient.auth.admin.updateUserById(auth_user_id, updates);
      if (updateErr) {
        return jsonResp({ error: updateErr.message }, 400);
      }

      return jsonResp({ success: true });
    }

    // ── POST (create user) ────────────────────────────────────────
    const { email, password, fonction, status } = await req.json();

    if (!email || !password || !fonction || !status) {
      return jsonResp({ error: "Missing fields" }, 400);
    }

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !newUser.user) {
      return jsonResp({ error: createErr?.message ?? "Failed to create user" }, 400);
    }

    const authUserId = newUser.user.id;

    const { data: managed, error: managedErr } = await adminClient
      .from("managed_users")
      .insert({ email, fonction, status, auth_user_id: authUserId })
      .select()
      .single();

    if (managedErr) {
      await adminClient.auth.admin.deleteUser(authUserId);
      return jsonResp({ error: managedErr.message }, 400);
    }

    await adminClient.from("user_profiles").insert({ id: authUserId });

    return jsonResp({ user: managed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return jsonResp({ error: message }, status);
  }
});
