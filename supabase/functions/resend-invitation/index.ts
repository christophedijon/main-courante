import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
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

    // Verify caller is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: adminRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("email", caller.email!)
      .maybeSingle();
    if (!adminRow) return json({ error: "Forbidden" }, 403);

    const { etablissement_id, action = "resend_invite" } = await req.json();
    if (!etablissement_id) return json({ error: "Missing etablissement_id" }, 400);

    // Get Direction user
    const { data: managed, error: managedErr } = await adminClient
      .from("managed_users")
      .select("id, email, auth_user_id, first_login_at")
      .eq("etablissement_id", etablissement_id)
      .eq("fonction", "Direction")
      .maybeSingle();

    if (managedErr || !managed) {
      return json({ error: "Direction user not found" }, 404);
    }

    const appUrl = Deno.env.get("APP_URL") ?? "";

    if (action === "reset_password") {
      // Send password reset email for already-activated users
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Main Courante <onboarding@resend.dev>";

      if (resendKey) {
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: managed.email,
          options: { redirectTo: appUrl },
        });
        if (linkErr) {
          console.error("[resend-invitation] generateLink recovery error:", linkErr);
          return json({ error: "Failed to generate reset link" }, 500);
        }
        const activateUrl = `${appUrl}/activate?link=${encodeURIComponent(linkData.properties.action_link)}`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [managed.email],
            subject: "Réinitialisation de votre mot de passe Main Courante",
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
                <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Réinitialisation du mot de passe</h1>
                <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">
                  Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
                </p>
                <a href="${activateUrl}"
                   style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
                  Réinitialiser mon mot de passe
                </a>
                <p style="color:#475569;font-size:12px;margin-top:24px">
                  Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                </p>
              </div>`,
          }),
        });
      } else {
        // Fallback to Supabase built-in reset email
        const anonClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        const { error: resetErr } = await anonClient.auth.resetPasswordForEmail(
          managed.email,
          { redirectTo: `${appUrl}/reset-password` }
        );
        if (resetErr) {
          console.error("[resend-invitation] resetPasswordForEmail error:", resetErr);
          return json({ error: "Failed to send reset email" }, 500);
        }
      }
      return json({ success: true, email: managed.email, action: "reset_password" });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "Main Courante <onboarding@resend.dev>";

    // resend_invite: delete old auth user + re-invite
    if (managed.auth_user_id) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(managed.auth_user_id);
      if (delErr) {
        console.error("[resend-invitation] deleteUser error:", delErr);
      }
    }

    let newAuthUserId: string;

    if (resendKey) {
      // Click-through approach: email contains /activate?link=... so Gmail cannot
      // pre-consume the OTP token by scanning the Supabase verify URL directly.
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: managed.email,
        options: { redirectTo: appUrl },
      });
      if (linkErr || !linkData?.user) {
        return json({ error: linkErr?.message ?? "Failed to generate invite link" }, 400);
      }
      newAuthUserId = linkData.user.id;

      const activateUrl = `${appUrl}/activate?link=${encodeURIComponent(linkData.properties.action_link)}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [managed.email],
          subject: "Activez votre compte Main Courante",
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
                <div style="width:40px;height:40px;background:#1e3a5f;border:1px solid #2563eb40;border-radius:10px;display:flex;align-items:center;justify-content:center">
                  <span style="color:#60a5fa;font-size:20px">🛡</span>
                </div>
                <span style="color:#fff;font-weight:700;font-size:18px">Main Courante</span>
              </div>
              <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Nouvelle invitation</h1>
              <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">
                Vous avez reçu une nouvelle invitation à rejoindre <strong style="color:#e2e8f0">Main Courante</strong>.<br/>
                Cliquez sur le bouton ci-dessous pour activer votre compte.
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
      // Fallback: Supabase built-in invite email (susceptible to Gmail pre-click)
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        managed.email,
        { redirectTo: appUrl }
      );
      if (inviteErr || !inviteData?.user) {
        return json({ error: inviteErr?.message ?? "Failed to resend invitation" }, 400);
      }
      newAuthUserId = inviteData.user.id;
    }

    // Update managed_users with new auth_user_id + invited_at
    await adminClient.from("managed_users").update({
      auth_user_id: newAuthUserId,
      invited_at: new Date().toISOString(),
      first_login_at: null,
    }).eq("id", managed.id);

    // Recreate user_profiles row
    await adminClient.from("user_profiles").upsert({ id: newAuthUserId });

    // Copy old profile data to new user_profiles entry
    if (managed.auth_user_id) {
      const { data: oldProfile } = await adminClient
        .from("user_profiles")
        .select("first_name, last_name, telephone")
        .eq("id", managed.auth_user_id)
        .maybeSingle();
      if (oldProfile) {
        await adminClient.from("user_profiles").update({
          first_name: oldProfile.first_name,
          last_name: oldProfile.last_name,
          telephone: oldProfile.telephone,
        }).eq("id", newAuthUserId);
        // Clean up old profile
        await adminClient.from("user_profiles").delete().eq("id", managed.auth_user_id);
      }
    }

    return json({ success: true, email: managed.email, action: "resend_invite" });
  } catch (err) {
    console.error("[resend-invitation] unhandled error:", err);
    return json({ error: "An error occurred processing your request." }, 500);
  }
});
