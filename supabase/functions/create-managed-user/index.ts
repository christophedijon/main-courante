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
    const { email, password, fonction, status, etablissement_id, invite, first_name, last_name, telephone } = await req.json();

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
      const appUrl = Deno.env.get("APP_URL") ?? "";
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Main Courante <onboarding@resend.dev>";

      if (resendKey) {
        // Click-through approach: prevents Gmail from pre-consuming the OTP token.
        // generateLink creates the auth user + invite token but does NOT send the email.
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo: appUrl },
        });
        if (linkErr || !linkData?.user) {
          return jsonResp({ error: linkErr?.message ?? "Failed to generate invite link" }, 400);
        }
        authUserId = linkData.user.id;

        const activateUrl = `${appUrl}/activate?link=${encodeURIComponent(linkData.properties.action_link)}`;
        const displayName = first_name ? `, ${first_name}` : "";
        const etabLabel   = etablissement_id ? "" : "";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: "Activez votre compte Main Courante",
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
                  <div style="width:40px;height:40px;background:#1e3a5f;border:1px solid #2563eb40;border-radius:10px;display:flex;align-items:center;justify-content:center">
                    <span style="color:#60a5fa;font-size:20px">🛡</span>
                  </div>
                  <span style="color:#fff;font-weight:700;font-size:18px">Main Courante</span>
                </div>
                <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Bienvenue${displayName}&nbsp;!</h1>
                <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">
                  Vous avez été invité(e) à rejoindre <strong style="color:#e2e8f0">Main Courante</strong>.<br/>
                  Cliquez sur le bouton ci-dessous pour activer votre compte${etabLabel}.
                </p>
                <a href="${activateUrl}"
                   style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
                  Activer mon compte
                </a>
                <p style="color:#475569;font-size:12px;margin-top:24px">
                  Ce lien est valable 24 heures. Si vous n'avez pas demandé cette invitation, ignorez cet email.
                </p>
              </div>`,
          }),
        });
      } else {
        // Fallback: use Supabase built-in invite email (susceptible to Gmail pre-click)
        const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: appUrl,
        });
        if (inviteErr || !inviteData?.user) {
          return jsonResp({ error: inviteErr?.message ?? "Failed to invite user" }, 400);
        }
        authUserId = inviteData.user.id;
      }
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
        ...(invite ? {
          invited_at: new Date().toISOString(),
          profile_completed: true,
        } : {}),
      })
      .select()
      .single();

    if (managedErr) {
      console.error("[create-managed-user] managed_users insert error:", managedErr);
      await adminClient.auth.admin.deleteUser(authUserId);
      return jsonResp({ error: "Failed to create user record." }, 400);
    }

    // Store profile fields (prenom/nom/tel) for invited users
    const profilePatch: Record<string, string> = {};
    if (first_name) profilePatch.first_name = first_name;
    if (last_name) profilePatch.last_name = last_name;
    if (telephone) profilePatch.telephone = telephone;

    if (Object.keys(profilePatch).length > 0) {
      await adminClient.from("user_profiles").upsert({ id: authUserId, ...profilePatch });
    } else {
      await adminClient.from("user_profiles").insert({ id: authUserId });
    }

    return jsonResp({ user: managed });
  } catch (err) {
    console.error("[create-managed-user] unhandled error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("Forbidden")) return jsonResp({ error: "Forbidden" }, 403);
    if (message.includes("not found")) return jsonResp({ error: "Not found" }, 404);
    return jsonResp({ error: "An error occurred processing your request." }, 500);
  }
});
