import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const { etablissement_id } = await req.json() as { etablissement_id?: string };

    if (!etablissement_id) {
      return json({ error: "Missing etablissement_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Idempotency guard — skip if already sent
    const { data: existing } = await supabase
      .from("reminder_logs")
      .select("id")
      .eq("etablissement_id", etablissement_id)
      .eq("reminder_type", "welcome")
      .maybeSingle();

    if (existing) {
      console.log("[send-welcome-email] Already sent for", etablissement_id, "— skipping");
      return json({ skipped: true, reason: "already_sent" });
    }

    // Fetch établissement
    const { data: etab, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, enseigne, type_erp, categorie_erp, effectif_public, adresse, email, telephone")
      .eq("id", etablissement_id)
      .maybeSingle();

    if (etabErr || !etab) {
      console.error("[send-welcome-email] etablissement not found:", etabErr);
      return json({ error: "Établissement introuvable" }, 404);
    }

    // Fetch Direction user
    const { data: direction } = await supabase
      .from("managed_users")
      .select("email, auth_user_id")
      .eq("etablissement_id", etablissement_id)
      .eq("fonction", "Direction")
      .maybeSingle();

    if (!direction?.email) {
      console.error("[send-welcome-email] No Direction user found for", etablissement_id);
      return json({ error: "Aucun utilisateur Direction trouvé" }, 404);
    }

    // Fetch first_name from user_profiles
    let prenom = "";
    if (direction.auth_user_id) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name")
        .eq("id", direction.auth_user_id)
        .maybeSingle();
      prenom = profile?.first_name ?? "";
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("[send-welcome-email] No RESEND_API_KEY — skipping email");
      return json({ skipped: true, reason: "no_resend_key" });
    }

    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";

    // Build HTML
    const nomEtab       = etab.nom ?? etab.enseigne ?? "Votre établissement";
    const enseigne      = etab.enseigne ?? nomEtab;
    const typeErp       = etab.type_erp ? `Type ${etab.type_erp}` : "—";
    const categorieErp  = etab.categorie_erp ? `${etab.categorie_erp}ème catégorie` : "—";
    const effectif      = etab.effectif_public ? `${etab.effectif_public} personnes` : "—";
    const adresse       = etab.adresse ? (etab.adresse as string).replace(/\n/g, ", ") : "—";
    const emailContact  = etab.email ?? "—";
    const telephone     = etab.telephone ?? "—";
    const greeting      = prenom ? `Bonjour ${prenom},` : "Bonjour,";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:620px;margin:0 auto;padding:32px 16px 48px">

  <!-- HEADER CARD -->
  <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 40px 28px;text-align:center">
    <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px">Main Courante</p>
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 10px;line-height:1.3">Bienvenue, ${greeting.replace('Bonjour ', '').replace(',', '')} !</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.6">
      Félicitations — <strong style="color:#e2e8f0">${nomEtab}</strong> est désormais configuré sur Main Courante.
    </p>
  </div>

  <!-- BODY CARD -->
  <div style="background:#ffffff;padding:0 40px 36px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

    <!-- SEPARATOR -->
    <div style="height:1px;background:linear-gradient(to right,#e2e8f0,#cbd5e1,#e2e8f0);margin:0 0 28px"></div>

    <!-- COORDONNÉES -->
    <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 14px">Vos coordonnées</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 28px">
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;width:160px;vertical-align:top">Établissement</td>
        <td style="padding:9px 0;color:#1e293b;font-weight:600">${nomEtab}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;vertical-align:top">Enseigne</td>
        <td style="padding:9px 0;color:#334155">${enseigne}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;vertical-align:top">Type ERP</td>
        <td style="padding:9px 0;color:#334155">${typeErp} — Catégorie ${categorieErp}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;vertical-align:top">Effectif max autorisé</td>
        <td style="padding:9px 0;color:#334155">${effectif}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;vertical-align:top">Adresse</td>
        <td style="padding:9px 0;color:#334155">${adresse}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#94a3b8;font-weight:600;vertical-align:top">Contact</td>
        <td style="padding:9px 0;color:#334155">${emailContact} — ${telephone}</td>
      </tr>
    </table>

    <!-- SEPARATOR -->
    <div style="height:1px;background:linear-gradient(to right,#e2e8f0,#cbd5e1,#e2e8f0);margin:0 0 28px"></div>

    <!-- POURQUOI -->
    <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 14px">Pourquoi Main Courante est essentiel pour votre établissement</p>
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 24px">
      En tant qu'exploitant d'un ERP, vous êtes personnellement responsable de la sécurité de votre public.
      En cas d'incident, les autorités (commission de sécurité, préfecture, procureur) examinent
      systématiquement votre capacité à démontrer que vous avez pris toutes les mesures nécessaires.
    </p>

    <!-- Bloc 1 -->
    <div style="margin:0 0 12px;padding:16px 18px 16px 20px;background:#f8fafc;border-left:3px solid #1e40af;border-radius:0 8px 8px 0">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e293b">Protection juridique</p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.75">
        Main Courante constitue votre preuve de diligence. Chaque événement horodaté, chaque ronde tracée,
        chaque vérification documentée est un élément qui vous protège en cas de mise en cause.
        L'article R123-51 du CCH impose la tenue d'un registre de sécurité — Main Courante
        le dématérialise et le rend infalsifiable.
      </p>
    </div>

    <!-- Bloc 2 -->
    <div style="margin:0 0 12px;padding:16px 18px 16px 20px;background:#f8fafc;border-left:3px solid #0e7a4a;border-radius:0 8px 8px 0">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e293b">Conformité réglementaire</p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.75">
        Votre registre de sécurité numérique, vos vérifications périodiques et le suivi de votre effectif
        (art. GN 11) sont accessibles en un clic lors d'un contrôle. Plus besoin de chercher des
        classeurs papier ou des attestations égarées.
      </p>
    </div>

    <!-- Bloc 3 -->
    <div style="margin:0 0 12px;padding:16px 18px 16px 20px;background:#f8fafc;border-left:3px solid #b45309;border-radius:0 8px 8px 0">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e293b">Prévention des fermetures administratives</p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.75">
        Un avis défavorable de la commission de sécurité peut entraîner une fermeture administrative
        immédiate de votre établissement (art. L123-4 du CCH). Main Courante vous aide à anticiper
        les échéances, à tracer vos actions correctives et à démontrer votre professionnalisme.
      </p>
    </div>

    <!-- Bloc 4 -->
    <div style="margin:0 0 28px;padding:16px 18px 16px 20px;background:#f8fafc;border-left:3px solid #1d4ed8;border-radius:0 8px 8px 0">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e293b">Toute votre sécurité en un seul endroit</p>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.75">
        Main courante de sécurité, registre de sécurité incendie, jauge de capacité, rondes de
        vérification, rapports automatiques — tout est centralisé, horodaté et exportable.
      </p>
    </div>

    <!-- SIGNATURE LINE -->
    <p style="color:#475569;font-size:14px;line-height:1.8;margin:0 0 28px;font-style:italic;border-top:1px solid #f1f5f9;padding-top:20px">
      Vous êtes un professionnel de l'ERP. Main Courante est l'outil conçu par des professionnels
      de l'ERP, pour vous.
    </p>

    <!-- SEPARATOR -->
    <div style="height:1px;background:linear-gradient(to right,#e2e8f0,#cbd5e1,#e2e8f0);margin:0 0 28px"></div>

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 24px">
      <a href="https://maincourante.eu"
         style="display:inline-block;background:#1d4ed8;color:#ffffff;font-size:15px;font-weight:700;
                padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.02em">
        Accéder à Main Courante →
      </a>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:13px;margin:0">
      Des questions ? Répondez directement à cet email.
    </p>

  </div>

  <!-- FOOTER -->
  <div style="padding:24px 0 0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;font-weight:600">L'équipe Main Courante</p>
    <p style="color:#cbd5e1;font-size:11px;margin:0 0 4px">
      <a href="https://maincourante.eu" style="color:#94a3b8;text-decoration:none">maincourante.eu</a>
      &nbsp;·&nbsp;
      <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a>
    </p>
    <p style="color:#cbd5e1;font-size:11px;margin:0">
      Cet email a été envoyé à ${direction.email} suite à la configuration de votre établissement.
    </p>
  </div>

</div>
</body>
</html>`;

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: direction.email,
      replyTo: "contact@maincourante.eu",
      subject: `Bienvenue dans Main Courante — Votre sécurité, notre priorité`,
      html,
    });

    // Log to prevent duplicate sends
    await supabase.from("reminder_logs").insert({
      etablissement_id,
      reminder_type: "welcome",
      recipient_email: direction.email,
    });

    console.log("[send-welcome-email] Sent to", direction.email, "for etab", etablissement_id);
    return json({ success: true, recipient: direction.email });

  } catch (err) {
    console.error("[send-welcome-email] unhandled error:", err);
    return json({ error: err instanceof Error ? err.message : "An error occurred" }, 500);
  }
});
