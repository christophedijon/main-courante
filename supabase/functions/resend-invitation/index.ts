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

async function sendViaResend(
  resendKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  console.log("[resend] Calling Resend API, to:", to, "from:", fromEmail);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  });
  const resBody = await res.text();
  console.log("[resend] Response status:", res.status, "body:", resBody);
  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${resBody}`);
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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    // onboarding@resend.dev works on Resend free plan but only to the account owner email.
    // Set FROM_EMAIL secret to a verified domain sender for production use.
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

    console.log("[resend-invitation] action:", action, "email:", managed.email);
    console.log("[resend-invitation] RESEND_API_KEY present:", !!resendKey);
    console.log("[resend-invitation] APP_URL:", appUrl);

    // ── reset_password ──────────────────────────────────────────────────────
    if (action === "reset_password") {
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
        console.log("[resend-invitation] Recovery activateUrl (truncated):", activateUrl.substring(0, 100));
        await sendViaResend(
          resendKey, fromEmail, managed.email,
          "Réinitialisation de votre mot de passe Main Courante",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
            <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Réinitialisation du mot de passe</h1>
            <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.</p>
            <a href="${activateUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Réinitialiser mon mot de passe</a>
            <p style="color:#475569;font-size:12px;margin-top:24px">Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          </div>`,
        );
      } else {
        console.log("[resend-invitation] No RESEND_API_KEY — using Supabase reset email");
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

    // ── resend_invite ────────────────────────────────────────────────────────
    if (managed.auth_user_id) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(managed.auth_user_id);
      if (delErr) {
        console.error("[resend-invitation] deleteUser error (non-fatal):", delErr);
      }
    }

    let newAuthUserId: string;

    if (resendKey) {
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: managed.email,
        options: { redirectTo: appUrl },
      });
      if (linkErr || !linkData?.user) {
        console.error("[resend-invitation] generateLink invite error:", linkErr);
        return json({ error: linkErr?.message ?? "Failed to generate invite link" }, 400);
      }
      newAuthUserId = linkData.user.id;
      console.log("[resend-invitation] Generated invite for user:", newAuthUserId);

      const activateUrl = `${appUrl}/activate?link=${encodeURIComponent(linkData.properties.action_link)}`;
      console.log("[resend-invitation] Invite activateUrl (truncated):", activateUrl.substring(0, 100));

      await sendViaResend(
        resendKey, fromEmail, managed.email,
        "Activez votre compte Main Courante",
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;padding:32px;border-radius:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
            <div style="width:40px;height:40px;background:#1e3a5f;border:1px solid rgba(37,99,235,0.25);border-radius:10px;text-align:center;line-height:40px;font-size:20px">🛡</div>
            <span style="color:#fff;font-weight:700;font-size:18px">Main Courante</span>
          </div>
          <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Nouvelle invitation</h1>
          <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Vous avez reçu une invitation à rejoindre <strong style="color:#e2e8f0">Main Courante</strong>.<br/>Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
          <a href="${activateUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Activer mon compte</a>
          <p style="color:#475569;font-size:12px;margin-top:24px">Ce lien est valable 24 heures. Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
        </div>`,
      );
    } else {
      console.log("[resend-invitation] No RESEND_API_KEY — falling back to Supabase invite email");
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        managed.email,
        { redirectTo: appUrl }
      );
      if (inviteErr || !inviteData?.user) {
        return json({ error: inviteErr?.message ?? "Failed to resend invitation" }, 400);
      }
      newAuthUserId = inviteData.user.id;
    }

    await adminClient.from("managed_users").update({
      auth_user_id: newAuthUserId,
      invited_at: new Date().toISOString(),
      first_login_at: null,
    }).eq("id", managed.id);

    await adminClient.from("user_profiles").upsert({ id: newAuthUserId });

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
        await adminClient.from("user_profiles").delete().eq("id", managed.auth_user_id);
      }
    }

    console.log("[resend-invitation] Done, success");
    return json({ success: true, email: managed.email, action: "resend_invite" });
  } catch (err) {
    console.error("[resend-invitation] unhandled error:", err);
    return json({ error: err instanceof Error ? err.message : "An error occurred" }, 500);
  }
});
