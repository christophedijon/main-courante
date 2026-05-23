import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAKE_WEBHOOK = "https://hook.eu2.make.com/7g0h9yj07m25am6l5gtpvzbd12mkspbt";

type RegistreItem = {
  installation: string;
  reference_reglementaire: string;
  organisme_verificateur: string;
  email_organisme: string | null;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
  jours_rappel: number | null;
};

type EmailRule = {
  active: boolean;
  dest_direction: boolean;
  dest_chef_de_poste: boolean;
  dest_agent_securite: boolean;
  dest_serveur: boolean;
  dest_email_organisme: boolean;
  dest_emails_libres: string[];
  rappel_retard_frequence: "quotidien" | "hebdomadaire" | "mensuel";
};

type AlertEntry =
  | { kind: "retard"; item: RegistreItem; jours: number }
  | { kind: "bientot"; item: RegistreItem; next: Date; joursRestants: number };

function getNextDate(lastDate: string, periodicite: string): Date | null {
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case "mensuelle": d.setMonth(d.getMonth() + 1); break;
    case "trimestrielle": d.setMonth(d.getMonth() + 3); break;
    case "semestrielle": d.setMonth(d.getMonth() + 6); break;
    case "annuelle": d.setFullYear(d.getFullYear() + 1); break;
    case "triennale": d.setFullYear(d.getFullYear() + 3); break;
    case "quinquennale": d.setFullYear(d.getFullYear() + 5); break;
    default: return null;
  }
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function shouldSendRetard(frequence: string, now: Date): boolean {
  switch (frequence) {
    case "quotidien": return true;
    case "hebdomadaire": return now.getDay() === 1;
    case "mensuel": return now.getDate() === 1;
    default: return false;
  }
}

function buildOrganismeHtml(entries: AlertEntry[], entrepriseNom: string): string {
  const rows = entries.map((entry) => {
    const nextDate = entry.kind === "retard"
      ? (getNextDate(entry.item.date_verification!, entry.item.periodicite) ?? null)
      : entry.next;
    const nextDateStr = nextDate ? formatDate(nextDate) : "—";
    const statusColor = entry.kind === "retard" ? "#dc2626" : "#d97706";
    const statusText = entry.kind === "retard"
      ? `En retard · ${entry.jours} jour(s)`
      : `Échéance le ${formatDate(entry.next)} · J-${entry.joursRestants}`;

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 16px; font-size: 14px; color: #1e293b; font-weight: 500;">
          ${entry.item.installation}
        </td>
        <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">
          ${entry.item.reference_reglementaire}
        </td>
        <td style="padding: 12px 16px; font-size: 13px; color: #1e293b;">
          ${nextDateStr}
        </td>
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: ${statusColor};">
          ${statusText}
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #1e293b; padding: 24px 32px;">
      <p style="color: #94a3b8; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; margin: 0 0 8px 0; text-transform: uppercase;">
        Rappel officiel
      </p>
      <h1 style="color: #f1f5f9; font-size: 22px; font-weight: 700; margin: 0;">
        ${entrepriseNom}
      </h1>
      <p style="color: #94a3b8; font-size: 14px; margin: 4px 0 0 0;">
        Visite(s) périodique(s) à planifier
      </p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Madame, Monsieur,<br><br>
        Nous vous contactons afin de planifier la ou les visite(s) périodique(s)
        réglementaire(s) concernant notre établissement <strong>${entrepriseNom}</strong>.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-collapse: collapse; margin-bottom: 24px;">
        <tr style="background: #f1f5f9;">
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Installation</th>
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Référence</th>
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Échéance</th>
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Statut</th>
        </tr>
        ${rows}
      </table>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
        Nous restons à votre disposition pour convenir d'une date d'intervention.
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
        Cordialement,<br>
        <strong>${entrepriseNom}</strong>
      </p>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        Ce message est généré automatiquement par le système Main Courante
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: emailRule } = await supabase
      .from("email_rules")
      .select("*")
      .eq("type", "registre_securite")
      .limit(1)
      .maybeSingle();

    if (!emailRule?.active) {
      return new Response(
        JSON.stringify({ message: "Règle email registre inactive — pas d'envoi" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rule = emailRule as EmailRule;
    const now = new Date();

    const { data: items } = await supabase
      .from("registre_securite")
      .select("installation, reference_reglementaire, organisme_verificateur, email_organisme, periodicite, applicable, date_verification, jours_rappel")
      .eq("applicable", true)
      .not("date_verification", "is", null);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ message: "Aucune entrée applicable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const retard: { item: RegistreItem; jours: number }[] = [];
    const bientot: { item: RegistreItem; next: Date; joursRestants: number }[] = [];

    for (const item of items as RegistreItem[]) {
      const next = getNextDate(item.date_verification!, item.periodicite);
      if (!next) continue;
      const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 0) {
        retard.push({ item, jours: Math.abs(Math.ceil(diff)) });
      } else if (item.jours_rappel !== null && diff <= item.jours_rappel) {
        bientot.push({ item, next, joursRestants: Math.ceil(diff) });
      }
    }

    const sendRetard = retard.length > 0 && shouldSendRetard(rule.rappel_retard_frequence, now);
    const sendBientot = bientot.length > 0;

    if (!sendRetard && !sendBientot) {
      return new Response(
        JSON.stringify({ message: "Aucune alerte à envoyer aujourd'hui selon la fréquence configurée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build internal recipients (excluding organisme emails) ─────────────────
    const emailSet = new Set<string>((rule.dest_emails_libres ?? []).filter(Boolean));
    const fonctions: string[] = [];
    if (rule.dest_direction) fonctions.push("Direction");
    if (rule.dest_chef_de_poste) fonctions.push("Chef de Poste");
    if (rule.dest_agent_securite) fonctions.push("Agent de Sécurité");
    if (rule.dest_serveur) fonctions.push("Serveur");

    if (fonctions.length > 0) {
      const { data: roleUsers } = await supabase
        .from("managed_users")
        .select("email")
        .in("fonction", fonctions);
      (roleUsers ?? []).forEach((u: any) => { if (u.email) emailSet.add(u.email); });
    }

    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom")
      .limit(1)
      .maybeSingle();

    const entrepriseNom = (entreprise as any)?.nom ?? "Votre établissement";
    const nbAlertesTotal = (sendRetard ? retard.length : 0) + (sendBientot ? bientot.length : 0);

    // ── Send main internal email ───────────────────────────────────────────────
    let internalSent = 0;
    if (emailSet.size > 0) {
      const sujet = `Registre de sécurité — ${nbAlertesTotal} vérification(s) à traiter — ${entrepriseNom}`;

      const retardHtml = sendRetard && retard.length > 0 ? `
        <h2 style="color:#ef4444;font-size:16px;margin-bottom:12px;border-bottom:2px solid #ef4444;padding-bottom:6px;">
          En retard (${retard.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#1e1e2e;color:#94a3b8;">
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Installation</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Référence</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Retard</th>
            </tr>
          </thead>
          <tbody>
            ${retard.map(({ item, jours }) => `
              <tr style="border-bottom:1px solid #2d2d3d;">
                <td style="padding:8px 12px;font-size:13px;color:#f1f5f9;">${item.installation}</td>
                <td style="padding:8px 12px;font-size:12px;color:#94a3b8;">${item.reference_reglementaire}</td>
                <td style="padding:8px 12px;font-size:13px;color:#ef4444;font-weight:600;">${jours} jour(s)</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : "";

      const bientotHtml = sendBientot && bientot.length > 0 ? `
        <h2 style="color:#f59e0b;font-size:16px;margin-bottom:12px;border-bottom:2px solid #f59e0b;padding-bottom:6px;">
          Échéances à venir (${bientot.length})
        </h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#1e1e2e;color:#94a3b8;">
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Installation</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Référence</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Date limite</th>
              <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Dans</th>
            </tr>
          </thead>
          <tbody>
            ${bientot.map(({ item, next, joursRestants }) => `
              <tr style="border-bottom:1px solid #2d2d3d;">
                <td style="padding:8px 12px;font-size:13px;color:#f1f5f9;">${item.installation}</td>
                <td style="padding:8px 12px;font-size:12px;color:#94a3b8;">${item.reference_reglementaire}</td>
                <td style="padding:8px 12px;font-size:13px;color:#f59e0b;font-weight:600;">${formatDate(next)}</td>
                <td style="padding:8px 12px;font-size:13px;color:#f59e0b;">J-${joursRestants}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : "";

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8" /></head>
        <body style="background:#0f0f1a;font-family:system-ui,sans-serif;color:#e2e8f0;padding:32px;max-width:680px;margin:0 auto;">
          <div style="background:#1a1a2e;border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid #2d2d3d;">
            <h1 style="color:#ffffff;font-size:20px;margin:0 0 4px 0;">Registre de sécurité</h1>
            <p style="color:#64748b;font-size:13px;margin:0;">${entrepriseNom}</p>
          </div>
          <div style="background:#1a1a2e;border-radius:16px;padding:24px;border:1px solid #2d2d3d;">
            ${retardHtml}
            ${bientotHtml}
          </div>
          <p style="text-align:center;color:#475569;font-size:11px;margin-top:24px;">
            Registre de sécurité — Main Courante — ${entrepriseNom}
          </p>
        </body>
        </html>
      `;

      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: Array.from(emailSet), sujet, html }),
      });
      internalSent = emailSet.size;
    }

    // ── Send per-organisme personalized emails ─────────────────────────────────
    let organismeSentCount = 0;

    if (rule.dest_email_organisme) {
      // Collect all alert entries that have an organisme email, retard takes priority
      const organismeMap = new Map<string, AlertEntry[]>();

      // Track which items are already accounted for (retard wins over bientot)
      const retardInstallations = new Set(
        sendRetard ? retard.map((r) => r.item.installation) : []
      );

      if (sendRetard) {
        for (const r of retard) {
          if (!r.item.email_organisme) continue;
          const key = r.item.email_organisme;
          if (!organismeMap.has(key)) organismeMap.set(key, []);
          organismeMap.get(key)!.push({ kind: "retard", item: r.item, jours: r.jours });
        }
      }

      if (sendBientot) {
        for (const b of bientot) {
          if (!b.item.email_organisme) continue;
          // Skip if already added as retard for this installation
          if (retardInstallations.has(b.item.installation)) continue;
          const key = b.item.email_organisme;
          if (!organismeMap.has(key)) organismeMap.set(key, []);
          organismeMap.get(key)!.push({ kind: "bientot", item: b.item, next: b.next, joursRestants: b.joursRestants });
        }
      }

      for (const [email, entries] of organismeMap) {
        const installationNames = entries.map((e) => e.item.installation);
        const sujet = installationNames.length === 1
          ? `Rappel de visite périodique — ${installationNames[0]} — ${entrepriseNom}`
          : `Rappel de visites périodiques — ${installationNames.length} installations — ${entrepriseNom}`;

        const html = buildOrganismeHtml(entries, entrepriseNom);

        await fetch(MAKE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: [email], sujet, html }),
        });
        organismeSentCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Email interne envoyé à ${internalSent} destinataire(s), ${organismeSentCount} email(s) organisme envoyé(s)`,
        alertes: nbAlertesTotal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("rappel-registre error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
