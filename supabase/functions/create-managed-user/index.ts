import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
        console.error("[create-managed-user] deleteUser error:", delErr);
        return jsonResp({ error: "Failed to delete user." }, 400);
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
        console.error("[create-managed-user] updateUserById error:", updateErr);
        return jsonResp({ error: "Failed to update user." }, 400);
      }

      return jsonResp({ success: true });
    }

    // ── POST (create user) ────────────────────────────────────────
    const { email, password, fonction, status, etablissement_id, invite } = await req.json();

    if (!email || !fonction || !status) {
      return jsonResp({ error: "Missing fields" }, 400);
    }
    if (!invite && !password) {
      return jsonResp({ error: "Missing password" }, 400);
    }

    // Check for existing email in managed_users before attempting auth creation
    const { data: existingManaged } = await adminClient
      .from("managed_users")
      .select("id, auth_user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingManaged) {
      return jsonResp({ error: `Un compte avec l'adresse ${email} existe déjà.` }, 400);
    }

    let authUserId: string;

    if (invite) {
      // Send Supabase invite email — user sets password on first login
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (inviteErr || !inviteData?.user) {
        return jsonResp({ error: inviteErr?.message ?? "Failed to invite user" }, 400);
      }
      authUserId = inviteData.user.id;
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !newUser.user) {
        return jsonResp({ error: createErr?.message ?? "Failed to create user" }, 400);
      }
      authUserId = newUser.user.id;
    }

    const { data: managed, error: managedErr } = await adminClient
      .from("managed_users")
      .insert({
        email,
        fonction,
        status,
        auth_user_id: authUserId,
        ...(etablissement_id ? { etablissement_id } : {}),
      })
      .select()
      .single();

    if (managedErr) {
      console.error("[create-managed-user] managed_users insert error:", managedErr);
      await adminClient.auth.admin.deleteUser(authUserId);
      return jsonResp({ error: "Failed to create user record." }, 400);
    }

    await adminClient.from("user_profiles").insert({ id: authUserId });

    return jsonResp({ user: managed });
  } catch (err) {
    console.error("[create-managed-user] unhandled error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("Forbidden")) return jsonResp({ error: "Forbidden" }, 403);
    if (message.includes("not found")) return jsonResp({ error: "Not found" }, 404);
    return jsonResp({ error: "An error occurred processing your request." }, 500);
  }
});
