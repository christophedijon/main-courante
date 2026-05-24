import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  ${body}
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return htmlPage("Lien invalide", `
        <div style="background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="width: 64px; height: 64px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <span style="font-size: 32px;">✗</span>
          </div>
          <h1 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Lien invalide</h1>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">Ce lien est invalide ou incomplet.</p>
        </div>`);
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
      return htmlPage("Lien invalide ou expiré", `
        <div style="background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="width: 64px; height: 64px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <span style="font-size: 32px;">✗</span>
          </div>
          <h1 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Lien invalide ou expiré</h1>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">Ce lien de confirmation est invalide ou a expiré.</p>
        </div>`);
    }

    if (row.confirme_par_organisme && row.confirme_at) {
      const dateStr = new Date(row.confirme_at).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      return htmlPage("Déjà confirmé", `
        <div style="background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="width: 64px; height: 64px; background: #dbeafe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <span style="font-size: 32px;">✓</span>
          </div>
          <h1 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Déjà confirmé</h1>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">
            Cette prise en compte a déjà été enregistrée le <strong>${dateStr}</strong>.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: left; margin-top: 24px;">
            <p style="color: #64748b; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">Installation concernée</p>
            <p style="color: #1e293b; font-size: 14px; margin: 0; font-weight: 500;">${row.installation}</p>
          </div>
        </div>`);
    }

    // Fetch entreprise name for the success page
    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom")
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

    return htmlPage("Prise en compte enregistrée", `
      <div style="background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
          <span style="font-size: 32px;">✓</span>
        </div>
        <h1 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">
          Prise en compte enregistrée
        </h1>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
          Merci, votre prise en compte a été enregistrée.<br>
          En attente de votre retour.
        </p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: left;">
          <p style="color: #64748b; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">
            Installation concernée
          </p>
          <p style="color: #1e293b; font-size: 14px; margin: 0; font-weight: 500;">
            ${row.installation}
          </p>
        </div>
        ${entrepriseNom ? `<p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0 0;">${entrepriseNom}</p>` : ""}
      </div>`);

  } catch (err) {
    console.error("confirm-registre error:", err);
    return htmlPage("Erreur", `
      <div style="background: white; border-radius: 16px; padding: 48px 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <h1 style="color: #1e293b; font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">Erreur</h1>
        <p style="color: #475569; font-size: 15px;">Une erreur est survenue. Veuillez réessayer.</p>
      </div>`);
  }
});
