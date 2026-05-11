import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RegistreItem = {
  installation: string;
  reference_reglementaire: string;
  organisme_verificateur: string;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
};

type ManagedUser = {
  email: string;
  fonction: string;
};

type EntrepriseRow = {
  nom: string;
  logo_url: string | null;
};

function getNextDate(lastDate: string, periodicite: string): Date | null {
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case "annuelle": d.setFullYear(d.getFullYear() + 1); break;
    case "semestrielle": d.setMonth(d.getMonth() + 6); break;
    case "triennale": d.setFullYear(d.getFullYear() + 3); break;
    case "quinquennale": d.setFullYear(d.getFullYear() + 5); break;
    default: return null;
  }
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    // Récupérer toutes les lignes applicables avec date
    const { data: items } = await supabase
      .from("registre_securite")
      .select("installation, reference_reglementaire, organisme_verificateur, periodicite, applicable, date_verification")
      .eq("applicable", true)
      .not("date_verification", "is", null);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ message: "Aucune entrée applicable" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = Date.now();
    const retard: { item: RegistreItem; jours: number }[] = [];
    const bientot: { item: RegistreItem; next: Date }[] = [];

    for (const item of items as RegistreItem[]) {
      if (!item.applicable) continue;
      if (!item.date_verification) continue;
      const next = getNextDate(item.date_verification, item.periodicite);
      if (!next) continue;
      const diff = (next.getTime() - now) / (1000 * 60 * 60 * 24);
      if (diff < 0) {
        retard.push({ item, jours: Math.abs(Math.ceil(diff)) });
      } else if (diff <= 90) {
        bientot.push({ item, next });
      }
      // diff > 90 : pas d'alerte
    }

    if (retard.length === 0 && bientot.length === 0) {
      return new Response(JSON.stringify({ message: "Aucune alerte — pas d'email" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Récupérer les emails Direction
    const { data: users } = await supabase
      .from("managed_users")
      .select("email, fonction")
      .in("fonction", ["Direction"]);

    // Récupérer les super admins
    const { data: superAdmins } = await supabase
      .from("super_admins")
      .select("email");

    const emails = new Set<string>();
    (users as ManagedUser[] ?? []).forEach((u) => emails.add(u.email));
    (superAdmins as { email: string }[] ?? []).forEach((u) => emails.add(u.email));

    if (emails.size === 0) {
      return new Response(JSON.stringify({ message: "Aucun destinataire trouvé" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Récupérer les infos entreprise
    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom, logo_url")
      .limit(1)
      .maybeSingle();

    const entrepriseNom = (entreprise as EntrepriseRow | null)?.nom ?? "Votre établissement";

    const nbAlertesTotal = retard.length + bientot.length;
    const subject = `⚠ Registre de sécurité — ${nbAlertesTotal} vérification(s) à traiter — ${entrepriseNom}`;

    const retardHtml = retard.length > 0 ? `
      <h2 style="color:#ef4444;font-size:16px;margin-bottom:12px;border-bottom:2px solid #ef4444;padding-bottom:6px;">
        🚨 En retard (${retard.length})
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

    const bientotHtml = bientot.length > 0 ? `
      <h2 style="color:#f59e0b;font-size:16px;margin-bottom:12px;border-bottom:2px solid #f59e0b;padding-bottom:6px;">
        ⚠ À planifier dans moins de 3 mois (${bientot.length})
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#1e1e2e;color:#94a3b8;">
            <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Installation</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Référence</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;">Date limite</th>
          </tr>
        </thead>
        <tbody>
          ${bientot.map(({ item, next }) => `
            <tr style="border-bottom:1px solid #2d2d3d;">
              <td style="padding:8px 12px;font-size:13px;color:#f1f5f9;">${item.installation}</td>
              <td style="padding:8px 12px;font-size:12px;color:#94a3b8;">${item.reference_reglementaire}</td>
              <td style="padding:8px 12px;font-size:13px;color:#f59e0b;font-weight:600;">${formatDate(next)}</td>
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

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ message: "RESEND_API_KEY non configurée", alertes: retard.length + bientot.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResults = await Promise.all(
      Array.from(emails).map((email) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Main Courante <noreply@maincourante.app>",
            to: [email],
            subject,
            html,
          }),
        })
      )
    );

    const sent = emailResults.filter((r) => r.ok).length;

    return new Response(
      JSON.stringify({ message: `${sent} email(s) envoyé(s)`, alertes: retard.length + bientot.length }),
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
