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
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">

  <!-- HEADER -->
  <div style="background:#0f172a;padding:28px 24px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;background:#1e3a5f;border:1px solid rgba(37,99,235,0.3);border-radius:8px;text-align:center;line-height:36px;font-size:18px">🛡️</div>
      <span style="color:#ffffff;font-weight:700;font-size:20px;vertical-align:middle">Main Courante</span>
    </div>
  </div>

  <!-- BONJOUR -->
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0">
      Félicitations ! Votre établissement <strong style="color:#1e293b">${nomEtab}</strong>
      est désormais configuré sur Main Courante.
    </p>
  </div>

  <!-- COORDONNÉES -->
  <div style="margin:0 24px 24px;padding:20px 24px;background:#f1f5f9;border-radius:10px">
    <h3 style="color:#0f172a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 16px">
      Vos coordonnées
    </h3>
    <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse">
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap;width:130px">Établissement</td>
        <td style="padding:5px 0;color:#1e293b">${nomEtab}</td>
      </tr>
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap">Enseigne</td>
        <td style="padding:5px 0;color:#1e293b">${enseigne}</td>
      </tr>
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap">Type ERP</td>
        <td style="padding:5px 0;color:#1e293b">${typeErp} — ${categorieErp}</td>
      </tr>
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap">Effectif max</td>
        <td style="padding:5px 0;color:#1e293b">${effectif}</td>
      </tr>
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap">Adresse</td>
        <td style="padding:5px 0;color:#1e293b">${adresse}</td>
      </tr>
      <tr>
        <td style="padding:5px 16px 5px 0;font-weight:600;color:#64748b;white-space:nowrap">Contact</td>
        <td style="padding:5px 0;color:#1e293b">${emailContact} — ${telephone}</td>
      </tr>
    </table>
  </div>

  <!-- POURQUOI MAIN COURANTE -->
  <div style="padding:0 24px 8px">
    <h3 style="color:#1e293b;font-size:17px;font-weight:700;margin:0 0 16px">
      Pourquoi Main Courante est essentiel pour votre établissement
    </h3>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px">
      En tant qu'exploitant d'un ERP, vous êtes personnellement
      responsable de la sécurité de votre public. En cas d'incident,
      les autorités examinent systématiquement votre capacité à
      démontrer que vous avez pris toutes les mesures nécessaires.
    </p>

    <!-- Bloc 1 — Protection juridique -->
    <div style="margin:0 0 14px;padding:16px 18px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">🛡️ Protection juridique</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">
        Chaque événement horodaté, chaque ronde tracée, chaque
        vérification documentée constitue une preuve de votre
        diligence. L'article R123-51 du CCH impose la tenue d'un
        registre de sécurité — Main Courante le dématérialise
        et le rend infalsifiable.
      </p>
    </div>

    <!-- Bloc 2 — Conformité réglementaire -->
    <div style="margin:0 0 14px;padding:16px 18px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534">📋 Conformité réglementaire</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">
        Registre de sécurité, vérifications périodiques, suivi de
        l'effectif (art. GN 11) — tout est accessible en un clic
        lors d'un contrôle de la commission de sécurité.
      </p>
    </div>

    <!-- Bloc 3 — Prévention des fermetures -->
    <div style="margin:0 0 14px;padding:16px 18px;background:#fefce8;border-left:4px solid #eab308;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#854d0e">⚠️ Prévention des fermetures administratives</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">
        Un avis défavorable de la commission peut entraîner une
        fermeture administrative immédiate (art. L123-4 du CCH).
        Main Courante vous aide à anticiper et à démontrer
        votre professionnalisme.
      </p>
    </div>

    <!-- Bloc 4 — Tout en un seul endroit -->
    <div style="margin:0 0 28px;padding:16px 18px;background:#f5f3ff;border-left:4px solid #8b5cf6;border-radius:6px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#5b21b6">🔒 Tout en un seul endroit</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">
        Main courante, registre incendie, jauge de capacité, rondes,
        rapports automatiques — centralisé, horodaté et exportable.
      </p>
    </div>
  </div>

  <!-- CTA -->
  <div style="padding:0 24px 36px;text-align:center">
    <p style="color:#475569;font-size:14px;margin:0 0 20px">
      Notre équipe reste disponible si vous avez la moindre question.
    </p>
    <a href="https://maincourante.eu"
       style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;
              padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
      Accéder à mon espace
    </a>
  </div>

  <!-- FOOTER -->
  <div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;font-weight:600">Main Courante</p>
    <p style="color:#cbd5e1;font-size:11px;margin:0">
      Cet email a été envoyé à ${direction.email} suite à la création de votre compte.
    </p>
    <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0">
      Contactez-nous : <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a>
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
