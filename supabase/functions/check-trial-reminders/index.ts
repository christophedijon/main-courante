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

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

// ─── email builders ──────────────────────────────────────────────────────────

function headerBlock(title: string, subtitle: string, accentColor: string) {
  return `<div style="background:${accentColor};padding:28px 24px;text-align:center">
    <div style="display:inline-flex;align-items:center;gap:10px">
      <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    </div>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0">${subtitle}</p>
  </div>`;
}

function footerBlock(recipientEmail: string) {
  return `<div style="background:#f8fafc;padding:20px 24px;border-top:1px solid #e2e8f0;text-align:center">
    <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;font-weight:600">Main Courante</p>
    <p style="color:#cbd5e1;font-size:11px;margin:0">
      Cet email a été envoyé à ${recipientEmail}.
    </p>
    <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0">
      Contactez-nous : <a href="mailto:contact@maincourante.eu" style="color:#94a3b8;text-decoration:none">contact@maincourante.eu</a>
    </p>
  </div>`;
}

function ctaButton(label: string, href: string, color = "#2563eb") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">${label}</a>`;
}

// --- J+30 Testeur / J+15 Light (engagement précoce) ---
function buildEngagementPrecoceHtml(opts: {
  prenom: string;
  nomEtab: string;
  recipientEmail: string;
  plan: string;
  jourRestants: number;
}) {
  const greeting = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";
  const isPlanLight = opts.plan === "light";
  const tagline = isPlanLight
    ? "Votre essai Light — 15 jours déjà !"
    : "Votre essai Testeur — 30 jours déjà !";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  ${headerBlock("Main Courante", tagline, "#0f172a")}
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      Cela fait maintenant ${isPlanLight ? "15" : "30"} jours que <strong style="color:#1e293b">${opts.nomEtab}</strong>
      utilise Main Courante. Comment se passe votre expérience ?
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Il vous reste <strong style="color:#1e293b">${opts.jourRestants} jours</strong> pour profiter pleinement de votre essai.
      C'est le moment de découvrir toutes les fonctionnalités qui protègent votre établissement.
    </p>
  </div>

  <div style="margin:0 24px;padding:20px 24px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">Rappel : ce que vous avez déjà à disposition</p>
    <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.8">
      <li>Main courante horodatée et infalsifiable</li>
      <li>Registre de sécurité dématérialisé</li>
      <li>Suivi des effectifs en temps réel</li>
      <li>Rondes et vérifications tracées</li>
      <li>Rapports automatiques exportables</li>
    </ul>
  </div>

  <div style="padding:28px 24px;text-align:center">
    <p style="color:#475569;font-size:14px;margin:0 0 20px">
      Passez à l'abonnement maintenant et continuez sans interruption.
    </p>
    ${ctaButton("Voir les offres d'abonnement", "https://maincourante.eu/abonnement")}
  </div>

  ${footerBlock(opts.recipientEmail)}
</div></body></html>`;
}

// --- J+60 Testeur (engagement tardif avec stats) ---
function buildEngagementTardifHtml(opts: {
  prenom: string;
  nomEtab: string;
  recipientEmail: string;
  jourRestants: number;
  totalEvents: number;
  totalRondes: number;
}) {
  const greeting = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  ${headerBlock("Main Courante", "Votre essai Testeur — Bilan à 60 jours", "#0f172a")}
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      Cela fait <strong style="color:#1e293b">60 jours</strong> que <strong style="color:#1e293b">${opts.nomEtab}</strong>
      s'appuie sur Main Courante pour sa sécurité. Voici ce que vous avez accompli ensemble.
    </p>
  </div>

  <div style="margin:0 24px 24px;display:flex;gap:16px">
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">${opts.totalEvents}</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">événements enregistrés</p>
    </div>
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">${opts.totalRondes}</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">rondes effectuées</p>
    </div>
    <div style="flex:1;padding:20px;background:#f1f5f9;border-radius:10px;text-align:center">
      <p style="font-size:32px;font-weight:800;color:#2563eb;margin:0">${opts.jourRestants}</p>
      <p style="font-size:13px;color:#64748b;margin:6px 0 0">jours restants</p>
    </div>
  </div>

  <div style="padding:0 24px 8px">
    <div style="padding:16px 18px;background:#fefce8;border-left:4px solid #eab308;border-radius:6px">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#854d0e">Votre essai se termine bientôt</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7">
        Pour ne pas perdre vos données et continuer à protéger votre établissement,
        passez à l'abonnement avant la fin de votre période d'essai.
      </p>
    </div>
  </div>

  <div style="padding:28px 24px;text-align:center">
    ${ctaButton("Choisir mon abonnement", "https://maincourante.eu/abonnement")}
  </div>

  ${footerBlock(opts.recipientEmail)}
</div></body></html>`;
}

// --- J-20 Urgence ---
function buildUrgenceJ20Html(opts: {
  prenom: string;
  nomEtab: string;
  recipientEmail: string;
  dateFin: string;
}) {
  const greeting = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";
  const dateFormatted = new Date(opts.dateFin).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  ${headerBlock("Main Courante", "Votre essai se termine dans 20 jours", "#0f172a")}
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      La période d'essai de <strong style="color:#1e293b">${opts.nomEtab}</strong> se termine
      le <strong style="color:#1e293b">${dateFormatted}</strong>.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Après cette date, sans abonnement actif, votre accès sera suspendu et vous ne pourrez
      plus enregistrer d'événements ni consulter votre main courante.
    </p>
  </div>

  <div style="margin:0 24px 24px;padding:20px 24px;background:#fff7ed;border-left:4px solid #f97316;border-radius:6px">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#9a3412">Ce qui vous attend sans abonnement</p>
    <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.8">
      <li>Accès à l'interface suspendu</li>
      <li>Impossibilité d'enregistrer de nouveaux événements</li>
      <li>Vos données conservées 30 jours supplémentaires</li>
    </ul>
  </div>

  <div style="padding:0 24px 28px;text-align:center">
    <p style="color:#475569;font-size:14px;margin:0 0 20px">
      Souscrivez maintenant et continuez sans interruption.
    </p>
    ${ctaButton("Voir les offres d'abonnement", "https://maincourante.eu/abonnement", "#ea580c")}
  </div>

  ${footerBlock(opts.recipientEmail)}
</div></body></html>`;
}

// --- J-5 Urgence critique ---
function buildUrgenceJ5Html(opts: {
  prenom: string;
  nomEtab: string;
  recipientEmail: string;
  dateFin: string;
}) {
  const greeting = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";
  const dateFormatted = new Date(opts.dateFin).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#dc2626;padding:28px 24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:20px">Main Courante</span>
    <p style="color:rgba(255,255,255,0.9);font-size:13px;margin:6px 0 0">Plus que 5 jours — Action requise</p>
  </div>
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      <strong style="color:#dc2626">Votre essai se termine dans 5 jours</strong>, le ${dateFormatted}.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Après cette date, l'accès de <strong style="color:#1e293b">${opts.nomEtab}</strong> sera suspendu.
      Ne laissez pas votre protection de sécurité s'interrompre.
    </p>
  </div>

  <div style="margin:0 24px 28px;padding:20px 24px;background:#fef2f2;border:2px solid #dc2626;border-radius:10px;text-align:center">
    <p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 12px">
      5 jours pour sécuriser la continuité de votre établissement
    </p>
    <p style="color:#475569;font-size:13px;margin:0">
      Abonnez-vous maintenant pour maintenir votre conformité réglementaire sans interruption.
    </p>
  </div>

  <div style="padding:0 24px 36px;text-align:center">
    ${ctaButton("S'abonner maintenant", "https://maincourante.eu/abonnement", "#dc2626")}
  </div>

  ${footerBlock(opts.recipientEmail)}
</div></body></html>`;
}

// --- Essai expiré (client) ---
function buildExpireClientHtml(opts: {
  prenom: string;
  nomEtab: string;
  recipientEmail: string;
}) {
  const greeting = opts.prenom ? `Bonjour ${opts.prenom},` : "Bonjour,";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  ${headerBlock("Main Courante", "Votre période d'essai est terminée", "#64748b")}
  <div style="padding:36px 24px 20px">
    <h2 style="color:#1e293b;font-size:22px;font-weight:700;margin:0 0 12px">${greeting}</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px">
      La période d'essai de <strong style="color:#1e293b">${opts.nomEtab}</strong> est maintenant expirée.
      Votre accès à Main Courante a été suspendu.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Vos données sont conservées et accessibles dès que vous souscrivez un abonnement.
      Vous pouvez reprendre exactement là où vous en étiez.
    </p>
  </div>

  <div style="margin:0 24px 24px;padding:20px 24px;background:#f1f5f9;border-radius:10px">
    <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 8px">Vos données sont en sécurité</p>
    <p style="color:#475569;font-size:13px;line-height:1.7;margin:0">
      Toutes vos entrées main courante, vos rondes, vos registres et vos rapports sont conservés.
      Rien n'est effacé. Un abonnement vous redonne accès instantanément.
    </p>
  </div>

  <div style="padding:0 24px 28px;text-align:center">
    <p style="color:#475569;font-size:14px;margin:0 0 20px">
      Reprenez votre activité sans délai.
    </p>
    ${ctaButton("Réactiver mon compte", "https://maincourante.eu/abonnement")}
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">
      Ou contactez-nous : <a href="mailto:contact@maincourante.eu" style="color:#64748b;text-decoration:none">contact@maincourante.eu</a>
    </p>
  </div>

  ${footerBlock(opts.recipientEmail)}
</div></body></html>`;
}

// --- Essai expiré (équipe interne) ---
function buildExpireEquipeHtml(opts: {
  nomEtab: string;
  etablissementId: string;
  plan: string;
  dateActivation: string;
  dateFin: string;
  directionEmail: string;
  totalEvents: number;
}) {
  const dateFinFormatted = new Date(opts.dateFin).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const dateActivationFormatted = new Date(opts.dateActivation).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff;color:#1e293b">
  <div style="background:#1e293b;padding:24px;text-align:center">
    <span style="color:#ffffff;font-weight:700;font-size:18px">Main Courante — Notification interne</span>
    <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">Essai expiré</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="color:#1e293b;font-size:18px;font-weight:700;margin:0 0 20px">
      Essai expiré : ${opts.nomEtab}
    </h2>
    <table style="width:100%;font-size:14px;color:#334155;border-collapse:collapse">
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b;width:160px">Établissement</td>
        <td style="padding:6px 0;color:#1e293b">${opts.nomEtab}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">ID</td>
        <td style="padding:6px 0;color:#1e293b;font-size:12px;font-family:monospace">${opts.etablissementId}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Plan</td>
        <td style="padding:6px 0;color:#1e293b">${opts.plan}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Activation</td>
        <td style="padding:6px 0;color:#1e293b">${dateActivationFormatted}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Fin d'essai</td>
        <td style="padding:6px 0;color:#1e293b">${dateFinFormatted}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Direction</td>
        <td style="padding:6px 0;color:#1e293b">${opts.directionEmail}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-weight:600;color:#64748b">Événements</td>
        <td style="padding:6px 0;color:#1e293b">${opts.totalEvents} enregistrés</td>
      </tr>
    </table>
  </div>
  <div style="padding:0 24px 24px">
    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 18px">
      <p style="margin:0;font-size:13px;color:#7f1d1d">
        Le statut de cet établissement a été automatiquement mis à jour en <strong>expiré</strong>.
        Un suivi commercial est recommandé.
      </p>
    </div>
  </div>
</div></body></html>`;
}

// ─── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";

  const results: Array<{ etabId: string; actions: string[] }> = [];
  let totalSent = 0;
  let totalSkipped = 0;

  try {
    // Fetch all active trials with their Direction user
    const { data: trials, error: trialsErr } = await supabase
      .from("etablissements")
      .select(`
        id, nom, enseigne, plan, statut,
        date_activation, date_fin_essai,
        managed_users!inner(email, auth_user_id, fonction)
      `)
      .eq("statut", "essai")
      .eq("managed_users.fonction", "Direction")
      .not("date_activation", "is", null)
      .not("date_fin_essai", "is", null);

    if (trialsErr) {
      console.error("[check-trial-reminders] fetch error:", trialsErr);
      return json({ error: trialsErr.message }, 500);
    }

    console.log(`[check-trial-reminders] ${trials?.length ?? 0} active trials found`);

    for (const trial of (trials ?? [])) {
      const etabId = trial.id;
      const nomEtab = trial.nom ?? trial.enseigne ?? "Votre établissement";
      const plan: string = trial.plan ?? "testeur";
      const dateActivation: string = trial.date_activation;
      const dateFin: string = trial.date_fin_essai;
      const directionUser = Array.isArray(trial.managed_users)
        ? trial.managed_users[0]
        : trial.managed_users;

      if (!directionUser?.email) {
        console.warn(`[check-trial-reminders] No Direction email for ${etabId}`);
        continue;
      }

      const directionEmail: string = directionUser.email;
      const jours_depuis = daysSince(dateActivation);
      const jours_restants = daysUntil(dateFin);

      // Fetch prenom
      let prenom = "";
      if (directionUser.auth_user_id) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name")
          .eq("id", directionUser.auth_user_id)
          .maybeSingle();
        prenom = profile?.first_name ?? "";
      }

      // Fetch stats (event count + ronde count)
      const [eventsRes, rondesRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId),
        supabase.from("rondes").select("id", { count: "exact", head: true }).eq("etablissement_id", etabId),
      ]);
      const totalEvents = eventsRes.count ?? 0;
      const totalRondes = rondesRes.count ?? 0;

      // Existing reminder_logs for this etablissement
      const { data: existingLogs } = await supabase
        .from("reminder_logs")
        .select("reminder_type")
        .eq("etablissement_id", etabId);
      const sent = new Set((existingLogs ?? []).map((r: { reminder_type: string }) => r.reminder_type));

      const actions: string[] = [];

      async function sendEmail(
        reminderType: string,
        subject: string,
        html: string,
        toEmail: string
      ) {
        if (sent.has(reminderType)) {
          totalSkipped++;
          return;
        }
        if (!resendKey) {
          console.warn(`[check-trial-reminders] No RESEND_API_KEY — skipping ${reminderType}`);
          return;
        }
        const resend = new Resend(resendKey);
        const { error: sendErr } = await resend.emails.send({
          from: FROM_EMAIL,
          to: toEmail,
          replyTo: "contact@maincourante.eu",
          subject,
          html,
        });
        if (sendErr) {
          console.error(`[check-trial-reminders] Resend error for ${reminderType}:`, sendErr);
          return;
        }
        await supabase.from("reminder_logs").insert({
          etablissement_id: etabId,
          reminder_type: reminderType,
          recipient_email: toEmail,
        });
        actions.push(reminderType);
        totalSent++;
      }

      // ── EXPIRED ─────────────────────────────────────────────────────────────
      if (jours_restants <= 0) {
        // Update statut to expire
        await supabase
          .from("etablissements")
          .update({ statut: "expire" })
          .eq("id", etabId);

        await sendEmail(
          "expired_client",
          "Votre essai Main Courante est terminé",
          buildExpireClientHtml({ prenom, nomEtab, recipientEmail: directionEmail }),
          directionEmail
        );
        await sendEmail(
          "expired_team",
          `[Interne] Essai expiré — ${nomEtab}`,
          buildExpireEquipeHtml({
            nomEtab,
            etablissementId: etabId,
            plan,
            dateActivation,
            dateFin,
            directionEmail,
            totalEvents,
          }),
          "contact@maincourante.eu"
        );

        results.push({ etabId, actions });
        continue;
      }

      // ── URGENCE J-5 ──────────────────────────────────────────────────────────
      if (jours_restants <= 5) {
        await sendEmail(
          "urgence_j5",
          `⚠️ Plus que ${jours_restants} jour${jours_restants > 1 ? "s" : ""} — Votre essai se termine bientôt`,
          buildUrgenceJ5Html({ prenom, nomEtab, recipientEmail: directionEmail, dateFin }),
          directionEmail
        );
      }

      // ── URGENCE J-20 ─────────────────────────────────────────────────────────
      else if (jours_restants <= 20) {
        await sendEmail(
          "urgence_j20",
          "Votre essai Main Courante se termine bientôt",
          buildUrgenceJ20Html({ prenom, nomEtab, recipientEmail: directionEmail, dateFin }),
          directionEmail
        );
      }

      // ── ENGAGEMENT (mid-trial) ────────────────────────────────────────────────
      const isTesteur = plan === "testeur";
      const isLight = plan === "light";

      if (isTesteur && jours_depuis >= 60 && !sent.has("testeur_j60")) {
        await sendEmail(
          "testeur_j60",
          `${nomEtab} — Bilan à 60 jours sur Main Courante`,
          buildEngagementTardifHtml({ prenom, nomEtab, recipientEmail: directionEmail, jourRestants: jours_restants, totalEvents, totalRondes }),
          directionEmail
        );
      } else if (isTesteur && jours_depuis >= 30 && !sent.has("testeur_j30")) {
        await sendEmail(
          "testeur_j30",
          `${nomEtab} — 30 jours sur Main Courante`,
          buildEngagementPrecoceHtml({ prenom, nomEtab, recipientEmail: directionEmail, plan, jourRestants: jours_restants }),
          directionEmail
        );
      } else if (isLight && jours_depuis >= 15 && !sent.has("light_j15")) {
        await sendEmail(
          "light_j15",
          `${nomEtab} — 15 jours sur Main Courante`,
          buildEngagementPrecoceHtml({ prenom, nomEtab, recipientEmail: directionEmail, plan, jourRestants: jours_restants }),
          directionEmail
        );
      }

      results.push({ etabId, actions });
    }

    console.log(`[check-trial-reminders] Done. sent=${totalSent} skipped=${totalSkipped}`);
    return json({ success: true, totalSent, totalSkipped, results });

  } catch (err) {
    console.error("[check-trial-reminders] unhandled error:", err);
    return json({ error: err instanceof Error ? err.message : "An error occurred" }, 500);
  }
});
