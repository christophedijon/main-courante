import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return json({ success: false, error: "invalid_token" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: row, error } = await supabase
      .from("registre_securite")
      .select("id, installation, email_organisme, confirme_par_organisme, confirme_at")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (error || !row) {
      return json({ success: false, error: "invalid_token" }, 404);
    }

    if (row.confirme_par_organisme && row.confirme_at) {
      return json({
        success: false,
        error: "already_confirmed",
        installation: row.installation,
        confirme_at: row.confirme_at,
      });
    }

    const { data: entreprise } = await supabase
      .from("etablissements")
      .select("nom")
      .in("statut", ["essai", "actif"])
      .limit(1)
      .maybeSingle();
    const entrepriseNom = (entreprise as any)?.nom ?? "";

    await supabase
      .from("registre_securite")
      .update({
        confirme_par_organisme: true,
        confirme_at: new Date().toISOString(),
        confirme_organisme_email: row.email_organisme ?? null,
      })
      .eq("confirmation_token", token);

    return json({
      success: true,
      installation: row.installation,
      entreprise: entrepriseNom,
    });

  } catch (err) {
    console.error("confirm-registre error:", err);
    return json({ success: false, error: "server_error" }, 500);
  }
});
