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
    const displayPrenom = prenom || "vous";

    // Conformité score (filled fields / total)
    const fieldsForConformite = [etab.nom, etab.enseigne, etab.type_erp, etab.categorie_erp, etab.effectif_public, etab.adresse, etab.email, etab.telephone];
    const filledCount = fieldsForConformite.filter(Boolean).length;
    const conformite = Math.round((filledCount / fieldsForConformite.length) * 100);
    // SVG gauge needle — center (70,72), radius 42
    const needleX = Math.round(70 - 42 * Math.cos(conformite * Math.PI / 100));
    const needleY = Math.round(72 - 42 * Math.sin(conformite * Math.PI / 100));

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  @media screen and (max-width:600px){
    .wlc-outer{padding:0 4px!important}
    .card-td{display:block!important;width:100%!important;box-sizing:border-box!important}
    .card-td-right{border-left:none!important;border-top:1px solid #1e2d4a!important}
    .tile-table{display:block!important;width:100%!important}
    .tile-tr{display:block!important;text-align:center!important}
    .tile-td{display:inline-block!important;width:44%!important;min-width:0!important;box-sizing:border-box!important;vertical-align:top!important;padding:4px!important}
    .pq-td{display:block!important;width:100%!important;box-sizing:border-box!important}
    .pq-td-right{border-left:none!important;border-top:1px solid #1e2d4a!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" class="wlc-outer" style="max-width:600px;width:100%">

  <!-- HEADER -->
  <tr><td align="center" style="padding:40px 24px 16px">
    <svg width="48" height="54" viewBox="0 0 48 54" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 14px">
      <path d="M24 2L46 11V31C46 42 36 50 24 52C12 50 2 42 2 31V11Z" fill="rgba(37,99,235,0.1)" stroke="#2563eb" stroke-width="1.5"/>
      <path d="M24 18v16M16 26h16" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <p style="color:#e2e8f0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;margin:0 0 4px">Main Courante</p>
    <p style="color:#334155;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;margin:0">La sécurité des ERP. Simplement.</p>
  </td></tr>

  <!-- GREETING -->
  <tr><td align="center" style="padding:8px 32px 28px">
    <h1 style="color:#f1f5f9;font-size:30px;font-weight:800;margin:0 0 10px;line-height:1.25">
      Bienvenue, <span style="color:#f59e0b">${displayPrenom}</span>&nbsp;!
    </h1>
    <p style="color:#475569;font-size:14px;margin:0;line-height:1.6">
      Votre établissement est désormais configuré sur Main Courante.
    </p>
  </td></tr>

  <!-- ÉTABLISSEMENT CARD -->
  <tr><td style="padding:0 16px 10px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:12px;overflow:hidden">
      <tr>
        <!-- Info -->
        <td class="card-td" width="55%" style="padding:20px;vertical-align:top">
          <table cellpadding="0" cellspacing="0" style="margin-bottom:16px">
            <tr>
              <td style="padding-right:10px;vertical-align:middle">
                <div style="width:32px;height:32px;background:#1e293b;border-radius:7px;text-align:center;line-height:32px;font-size:15px">🏢</div>
              </td>
              <td style="vertical-align:middle">
                <p style="color:#f1f5f9;font-size:13px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.04em">${nomEtab}</p>
                <p style="color:#334155;font-size:11px;margin:2px 0 0">${enseigne}</p>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 10px 4px 0;color:#334155;font-size:12px;white-space:nowrap;vertical-align:top">Type ERP</td>
              <td style="padding:4px 0;color:#94a3b8;font-size:12px">${typeErp}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;color:#334155;font-size:12px;white-space:nowrap;vertical-align:top">Catégorie</td>
              <td style="padding:4px 0;color:#94a3b8;font-size:12px">${categorieErp}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;color:#334155;font-size:12px;white-space:nowrap;vertical-align:top">Jauge max autorisée</td>
              <td style="padding:4px 0;color:#f97316;font-size:12px;font-weight:600">${effectif}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;color:#334155;font-size:12px;white-space:nowrap;vertical-align:top">Adresse</td>
              <td style="padding:4px 0;color:#94a3b8;font-size:12px">${adresse}</td>
            </tr>
            <tr>
              <td style="padding:4px 10px 4px 0;color:#334155;font-size:12px;white-space:nowrap;vertical-align:top">Contact</td>
              <td style="padding:4px 0;font-size:12px">
                <a href="mailto:${emailContact}" style="color:#60a5fa;text-decoration:none;display:block">${emailContact}</a>
                <span style="color:#94a3b8">${telephone}</span>
              </td>
            </tr>
          </table>
        </td>
        <!-- Gauge -->
        <td class="card-td card-td-right" width="45%" style="padding:20px;vertical-align:middle;text-align:center;border-left:1px solid #1e2d4a">
          <svg width="140" height="82" viewBox="0 0 140 82" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">
            <path d="M10,75 A60,60 0 0,0 130,75" fill="none" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
            <path d="M10,75 A60,60 0 0,0 28,33" fill="none" stroke="#ef4444" stroke-width="10" stroke-linecap="butt"/>
            <path d="M28,33 A60,60 0 0,0 70,15" fill="none" stroke="#f97316" stroke-width="10" stroke-linecap="butt"/>
            <path d="M70,15 A60,60 0 0,0 112,33" fill="none" stroke="#eab308" stroke-width="10" stroke-linecap="butt"/>
            <path d="M112,33 A60,60 0 0,0 130,75" fill="none" stroke="#22c55e" stroke-width="10" stroke-linecap="round"/>
            <line x1="70" y1="75" x2="${needleX}" y2="${needleY}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="70" cy="75" r="5" fill="#1e293b" stroke="#ffffff" stroke-width="2"/>
          </svg>
          <p style="color:#f59e0b;font-size:26px;font-weight:800;margin:6px 0 2px;line-height:1">${conformite}%</p>
          <p style="color:#334155;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Conformité initiale</p>
          <p style="color:#1e293b;font-size:11px;line-height:1.5;margin:0;padding:0 4px">
            Complétez les informations manquantes pour atteindre une conformité optimale.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- 4 FEATURE TILES -->
  <tr><td style="padding:0 16px 10px">
    <table class="tile-table" width="100%" cellpadding="0" cellspacing="0">
      <tr class="tile-tr">
        <td class="tile-td" width="24%" style="padding-right:6px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:10px">
            <tr><td style="padding:16px 8px;text-align:center">
              <div style="font-size:24px;line-height:1;margin-bottom:8px">🔥</div>
              <p style="color:#f1f5f9;font-size:11px;font-weight:700;margin:0 0 4px">SSI</p>
              <p style="color:#ef4444;font-size:10px;margin:0;line-height:1.4">Sécurité Incendie</p>
            </td></tr>
          </table>
        </td>
        <td class="tile-td" width="24%" style="padding:0 3px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:10px">
            <tr><td style="padding:16px 8px;text-align:center">
              <div style="font-size:24px;line-height:1;margin-bottom:8px">👥</div>
              <p style="color:#f1f5f9;font-size:11px;font-weight:700;margin:0 0 4px">Gestion client</p>
              <p style="color:#60a5fa;font-size:10px;margin:0;line-height:1.4">Sécurité des personnes</p>
            </td></tr>
          </table>
        </td>
        <td class="tile-td" width="26%" style="padding:0 3px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e293b;border:1px solid #334155;border-radius:10px">
            <tr><td style="padding:14px 8px;text-align:center">
              <p style="color:#ef4444;font-size:10px;font-weight:900;text-transform:uppercase;line-height:1.25;margin:0 0 8px;letter-spacing:0.04em">REGISTRE<br>DE<br>SÉCURITÉ</p>
              <p style="color:#f1f5f9;font-size:11px;font-weight:700;margin:0 0 4px">Registre</p>
              <p style="color:#f59e0b;font-size:10px;margin:0;line-height:1.4">Main courante numérique</p>
            </td></tr>
          </table>
        </td>
        <td class="tile-td" width="26%" style="padding-left:6px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:10px">
            <tr><td style="padding:16px 8px;text-align:center">
              <div style="font-size:24px;line-height:1;margin-bottom:8px">⏱️</div>
              <p style="color:#f1f5f9;font-size:11px;font-weight:700;margin:0 0 4px">Jauge</p>
              <p style="color:#64748b;font-size:10px;margin:0;line-height:1.4">Suivi de capacité en temps réel</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- POURQUOI SECTION -->
  <tr><td style="padding:0 16px 10px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:12px;overflow:hidden">
      <tr>
        <!-- Visual -->
        <td class="pq-td" width="38%" style="padding:20px;background:#110808;vertical-align:middle;text-align:center">
          <div style="background:#dc2626;border-radius:8px;padding:14px 12px;margin-bottom:10px">
            <p style="color:#ffffff;font-size:14px;font-weight:900;text-transform:uppercase;margin:0;line-height:1.4;letter-spacing:0.04em">REGISTRE<br>DE<br>SÉCURITÉ</p>
          </div>
          <table cellpadding="0" cellspacing="2" style="margin:0 auto">
            <tr>
              <td><div style="background:#ef4444;border-radius:4px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px">🔥</div></td>
              <td><div style="background:#16a34a;border-radius:4px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px">↩</div></td>
              <td><div style="background:#2563eb;border-radius:4px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px">🏃</div></td>
              <td><div style="background:#dc2626;border-radius:4px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px">📋</div></td>
              <td><div style="background:#16a34a;border-radius:4px;width:24px;height:24px;text-align:center;line-height:24px;font-size:13px">♿</div></td>
            </tr>
          </table>
        </td>
        <!-- Text -->
        <td class="pq-td pq-td-right" style="padding:20px;vertical-align:top;border-left:1px solid #1e2d4a">
          <p style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Pourquoi c'est essentiel ?</p>
          <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0 0 10px">
            En tant qu'exploitant d'un ERP, vous êtes personnellement responsable de la sécurité de votre public.
          </p>
          <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0 0 10px">
            Main Courante horodate, trace et archive chaque événement, chaque vérification et chaque action corrective.
          </p>
          <p style="color:#f97316;font-size:13px;line-height:1.7;margin:0;font-style:italic">
            En cas de contrôle ou d'incident, votre capacité à démontrer vos actions est essentielle.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 16px 28px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #1e2d4a;border-radius:12px">
      <tr><td style="padding:32px 24px;text-align:center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 20px">
          <path d="M12 2L22 6V13C22 18 17 22 12 23C7 22 2 18 2 13V6Z" fill="none" stroke="#2563eb" stroke-width="1.5"/>
        </svg>
        <a href="https://maincourante.eu"
           style="display:inline-block;border:1.5px solid #f59e0b;color:#f59e0b;font-size:13px;font-weight:700;
                  text-transform:uppercase;letter-spacing:0.1em;padding:14px 36px;border-radius:8px;text-decoration:none">
          Accéder à mon tableau de bord &nbsp;→
        </a>
        <p style="color:#334155;font-size:12px;margin:18px 0 0;line-height:1.6">
          Des questions ? Répondez directement à cet email,<br>notre équipe vous répond rapidement.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:0 24px 40px;text-align:center">
    <p style="color:#334155;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 6px">L'équipe Main Courante</p>
    <p style="color:#1e293b;font-size:11px;margin:0 0 6px">
      <a href="https://maincourante.eu" style="color:#334155;text-decoration:none">maincourante.eu</a>
      &nbsp;·&nbsp;
      <a href="mailto:contact@maincourante.eu" style="color:#334155;text-decoration:none">contact@maincourante.eu</a>
    </p>
    <p style="color:#1e293b;font-size:11px;margin:0">
      Cet email a été envoyé à ${direction.email} suite à la configuration de votre établissement.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
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
