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

// Tables with etablissement_id, ordered children-before-parents to respect FK constraints
const TABLES_TO_DELETE = [
  "event_commentaires",
  "rondes_passages",
  "rondes_rapports",
  "rondes_config",
  "beacons",
  "jauge_actions",
  "jauge_etat",
  "signatures",
  "assignations",
  "postes",
  "registre_signatures",
  "registre_historique",
  "registre_securite",
  "evenements",
  "zones_ssi",
  "zones",
  "espaces",
  "editor_sessions",
  "email_rules",
  "rapport_email_settings",
  "rapports_soiree",
  "company_documents",
  "evacuation_plans",
  "toolbox_documents",
  "ia_settings",
  "managed_users",
  "super_admins",
  "entreprise",
];

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

    // Only super admins can delete establishments
    const { data: adminRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("email", caller.email!)
      .maybeSingle();

    if (!adminRow) return jsonResp({ error: "Forbidden" }, 403);

    const { etablissement_id } = await req.json();
    if (!etablissement_id) return jsonResp({ error: "Missing etablissement_id" }, 400);

    // Verify etablissement exists
    const { data: etab } = await adminClient
      .from("etablissements")
      .select("id, nom")
      .eq("id", etablissement_id)
      .maybeSingle();

    if (!etab) return jsonResp({ error: "Établissement non trouvé" }, 404);

    // Collect auth_user_ids before deleting managed_users
    const { data: managedUsers } = await adminClient
      .from("managed_users")
      .select("auth_user_id")
      .eq("etablissement_id", etablissement_id);

    const authUserIds = (managedUsers ?? [])
      .map((u: { auth_user_id: string | null }) => u.auth_user_id)
      .filter(Boolean) as string[];

    // Delete all child tables in order
    for (const table of TABLES_TO_DELETE) {
      const { error } = await adminClient
        .from(table)
        .delete()
        .eq("etablissement_id", etablissement_id);
      if (error) {
        console.error(`[delete-etablissement] ${table}:`, error.message);
      }
    }

    // Delete auth users (cascades to user_profiles, ia_historique, etc.)
    for (const authUserId of authUserIds) {
      const { error } = await adminClient.auth.admin.deleteUser(authUserId);
      if (error) {
        console.error(`[delete-etablissement] deleteUser ${authUserId}:`, error.message);
      }
    }

    // Finally delete the etablissement
    const { error: delErr } = await adminClient
      .from("etablissements")
      .delete()
      .eq("id", etablissement_id);

    if (delErr) {
      console.error("[delete-etablissement] delete etablissement:", delErr);
      return jsonResp({ error: "Erreur lors de la suppression finale." }, 500);
    }

    return jsonResp({ success: true, nom: etab.nom });
  } catch (err) {
    console.error("[delete-etablissement] unhandled:", err);
    return jsonResp({ error: "An error occurred" }, 500);
  }
});
