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
      return json({ success: true, email: managed.email, action: "reset_password" });
    }

    // resend_invite: delete old auth user + re-invite
    if (managed.auth_user_id) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(managed.auth_user_id);
      if (delErr) {
        console.error("[resend-invitation] deleteUser error:", delErr);
        // Continue anyway – the auth user might already be gone
      }
    }

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      managed.email,
      { redirectTo: `${appUrl}/setup-password` }
    );

    if (inviteErr || !inviteData?.user) {
      return json({ error: inviteErr?.message ?? "Failed to resend invitation" }, 400);
    }

    // Update managed_users with new auth_user_id + invited_at
    await adminClient.from("managed_users").update({
      auth_user_id: inviteData.user.id,
      invited_at: new Date().toISOString(),
      first_login_at: null,
    }).eq("id", managed.id);

    // Recreate user_profiles row
    await adminClient.from("user_profiles").upsert({ id: inviteData.user.id });

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
        }).eq("id", inviteData.user.id);
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
