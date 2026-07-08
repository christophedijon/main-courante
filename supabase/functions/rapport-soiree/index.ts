import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;

    const now = new Date();
    let debutSoiree: Date;
    let finSoiree: Date;

    if (isTest) {
      finSoiree = new Date(now);
      debutSoiree = new Date(now);
      debutSoiree.setUTCHours(debutSoiree.getUTCHours() - 48);
    } else {
      finSoiree = new Date(now);
      finSoiree.setUTCHours(7, 0, 0, 0);
      debutSoiree = new Date(finSoiree);
      debutSoiree.setUTCDate(debutSoiree.getUTCDate() - 1);
      debutSoiree.setUTCHours(15, 0, 0, 0);
    }

    const dateSoireeStr = debutSoiree.toISOString().split("T")[0];

    // Fetch all active etablissements
    const { data: etablissements, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, logo_url, effectif_public")
      .in("statut", ["essai", "actif"]);

    if (etabErr) throw etabErr;

    if (!etablissements || etablissements.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun établissement actif", date: dateSoireeStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      etab_id: string;
      nom: string;
      skipped?: string;
      nb_evenements?: number;
      nb_agents?: number;
      email_sent?: boolean;
    }> = [];

    for (const etab of etablissements) {
      // Duplicate guard scoped to this etablissement
      const { data: existing } = await supabase
        .from("rapports_soiree")
        .select("id")
        .eq("date_soiree", dateSoireeStr)
        .eq("etablissement_id", etab.id)
        .maybeSingle();

      if (!isTest && existing) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: "already_generated" });
        continue;
      }

      // Fetch evenements for THIS etablissement only
      const { data: evenements, error: evErr } = await supabase
        .from("evenements")
        .select(`
          id,
          created_at,
          date_evenement,
          type,
          espace_nom,
          zone_nom,
          niveau_label,
          commentaire,
          created_by,
          created_by_email,
          user_fonction,
          etablissement_nom
        `)
        .eq("etablissement_id", etab.id)
        .gte("date_evenement", debutSoiree.toISOString())
        .lte("date_evenement", finSoiree.toISOString())
        .order("date_evenement", { ascending: true });

      if (evErr) {
        console.error(`[rapport-soiree] evenements error for ${etab.nom}:`, evErr.message);
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: `evenements_error: ${evErr.message}` });
        continue;
      }

      if (!evenements || evenements.length === 0) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: "no_events" });
        continue;
      }

      const agentIds = [...new Set(evenements.map((e: any) => e.created_by).filter(Boolean))];

      const { data: profiles } = agentIds.length > 0 ? await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", agentIds) : { data: [] };

      const profMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => {
        const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
        if (full) profMap[p.id] = full;
      });
      evenements.forEach((e: any) => {
        if (e.created_by && !profMap[e.created_by] && e.created_by_email) {
          profMap[e.created_by] = e.created_by_email;
        }
      });

      // Fetch jauge_actions for THIS etablissement only
      const { data: jaugeActions } = await supabase
        .from("jauge_actions")
        .select("action, delta, created_at")
        .eq("etablissement_id", etab.id)
        .gte("created_at", debutSoiree.toISOString())
        .lte("created_at", finSoiree.toISOString())
        .order("created_at", { ascending: true });

      const nbSSI = evenements.filter((e: any) => e.type === "ssi").length;
      const nbPersonnes = evenements.filter((e: any) => e.type !== "ssi").length;

      let totalVisiteurs = 0;
      let countMax = 0;
      let heurePointe = "—";

      if (jaugeActions && jaugeActions.length > 0) {
        totalVisiteurs = (jaugeActions as any[])
          .filter((a) => a.action === "entree")
          .reduce((sum: number, a: any) => sum + (a.delta ?? 0), 0);

        let running = 0;
        let heurePointeDate: Date | null = null;
        for (const a of jaugeActions as any[]) {
          running = Math.max(0, running + (a.delta ?? 0));
          if (running > countMax) {
            countMax = running;
            heurePointeDate = new Date(a.created_at);
          }
        }

        if (heurePointeDate) {
          heurePointe = heurePointeDate.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Paris",
          }).replace(":", "h");
        }
      }

      const dateSoireeLabel = debutSoiree.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const heureDebut = debutSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const heureFin = finSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      const lignesEvenements = evenements.map((e: any) => {
        const heure = new Date(e.date_evenement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const agent = profMap[e.created_by] ?? e.created_by_email ?? "Inconnu";
        const typeColor =
          e.type === "ssi" ? "#ef4444" :
          e.type === "securite_personnes" ? "#3b82f6" :
          e.type === "radio" ? "#10b981" : "#f59e0b";
        const typeLabel =
          e.type === "ssi" ? "SSI" :
          e.type === "securite_personnes" ? "Sécurité" :
          e.type === "radio" ? "Radio" : (e.type ?? "—");

        return `
          <tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;white-space:nowrap">${heure}</td>
            <td style="padding:12px 16px">
              <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${typeColor};background:${typeColor}18">
                ${typeLabel}
              </span>
            </td>
            <td style="padding:12px 16px;font-size:13px;color:#374151">
              ${e.espace_nom ?? "—"}${e.zone_nom ? ` <span style="color:#9ca3af">/ ${e.zone_nom}</span>` : ""}
            </td>
            <td style="padding:12px 16px;font-size:13px;color:#374151">${e.niveau_label ?? "—"}</td>
            <td style="padding:12px 16px;font-size:13px;color:#374151">${agent}</td>
            <td class="col-hide" style="padding:12px 16px;font-size:13px;color:#6b7280;font-style:italic">${e.commentaire ?? "—"}</td>
          </tr>
        `;
      }).join("");

      const logoHtml = etab.logo_url
        ? `<img src="${etab.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
        : "";

      const nomEntreprise = etab.nom ?? "Rapport de soirée";

      const contenuHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rapport de soirée — ${dateSoireeLabel}</title>
  <style>
    @media screen and (max-width:600px){
      .rpt-header{padding:24px 20px 18px!important}
      .rpt-subtitle{padding:14px 20px!important}
      .rpt-stats{padding:16px 8px!important}
      .stat-table{display:block!important;width:100%!important}
      .stat-tr{display:block!important;text-align:center!important}
      .stat-td{display:inline-block!important;width:29%!important;min-width:0!important;box-sizing:border-box!important;vertical-align:top!important}
      .col-hide{display:none!important}
      .evt-table th,.evt-table td{padding:7px 8px!important;font-size:11px!important}
      .rpt-section{padding:16px 20px 10px!important}
      .rpt-footer{display:block!important;padding:16px 20px!important;text-align:center!important}
    }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:760px;margin:0 auto">

    <!-- En-tête -->
    <div class="rpt-header" style="background:#0f172a;border-radius:16px 16px 0 0;padding:36px 40px 28px">
      ${logoHtml}
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">Main Courante — Rapport automatique</p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;line-height:1.2">${nomEntreprise}</h1>
    </div>

    <!-- Sous-titre soirée -->
    <div class="rpt-subtitle" style="background:#1e293b;padding:18px 40px">
      <p style="color:#e2e8f0;font-size:17px;font-weight:700;margin:0 0 4px">Soirée du ${dateSoireeLabel}</p>
      <p style="color:#475569;font-size:13px;margin:0">${heureDebut} → ${heureFin}</p>
    </div>

    <!-- Stats -->
    <div class="rpt-stats" style="background:#f1f5f9;padding:20px 40px;border-bottom:1px solid #e2e8f0">
      <table class="stat-table" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr class="stat-tr">
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#1e293b;font-size:28px;font-weight:700;line-height:1;">${evenements.length}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Événements</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#ef4444;font-size:28px;font-weight:700;line-height:1;">${nbSSI}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">SSI</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#3b82f6;font-size:28px;font-weight:700;line-height:1;">${nbPersonnes}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Sécu</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#22c55e;font-size:28px;font-weight:700;line-height:1;">${agentIds.length}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Agents</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#22c55e;font-size:28px;font-weight:700;line-height:1;">${totalVisiteurs}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Visiteurs</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:14%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#f59e0b;font-size:28px;font-weight:700;line-height:1;">${countMax}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Max en salle</div>
              </td></tr>
            </table>
          </td>
          <td class="stat-td" style="padding:4px;width:16%">
            <table width="100%" cellpadding="16" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;text-align:center;">
              <tr><td>
                <div style="color:#60a5fa;font-size:28px;font-weight:700;line-height:1;">${heurePointe}</div>
                <div style="color:#6b7280;font-size:12px;margin-top:6px;">Heure de pointe</div>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Tableau des événements -->
    <div style="background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden">
      <div class="rpt-section" style="padding:24px 40px 16px">
        <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:0">Journal des événements</h2>
      </div>
      <table class="evt-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Type</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Espace / Zone</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Niveau</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Agent</th>
            <th class="col-hide" style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Commentaire</th>
          </tr>
        </thead>
        <tbody>${lignesEvenements}</tbody>
      </table>

      <!-- Pied de page -->
      <div class="rpt-footer" style="padding:20px 40px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
        <p style="font-size:12px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante</p>
        <p style="font-size:12px;color:#94a3b8;margin:0">${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>
    </div>

  </div>
</body>
</html>`;

      const { error: insertErr } = await supabase
        .from("rapports_soiree")
        .upsert({
          date_soiree: dateSoireeStr,
          etablissement_id: etab.id,
          debut_soiree: debutSoiree.toISOString(),
          fin_soiree: finSoiree.toISOString(),
          nb_evenements: evenements.length,
          nb_agents: agentIds.length,
          contenu_html: contenuHtml,
        }, { onConflict: "etablissement_id,date_soiree" });

      if (insertErr) {
        console.error(`[rapport-soiree] upsert error for ${etab.nom}:`, insertErr.message);
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: `upsert_error: ${insertErr.message}` });
        continue;
      }

      // Fetch email_rules for THIS etablissement only
      const { data: emailRule } = await supabase
        .from("email_rules")
        .select("*")
        .eq("type", "rapport_soiree")
        .eq("etablissement_id", etab.id)
        .limit(1)
        .maybeSingle();

      let emailSent = false;
      if (emailRule?.active) {
        const emailSet = new Set<string>((emailRule.dest_emails_libres ?? []).filter(Boolean));
        const fonctions: string[] = [];
        if (emailRule.dest_direction) fonctions.push("Direction");
        if (emailRule.dest_chef_de_poste) fonctions.push("Chef de Poste");
        if (emailRule.dest_agent_securite) fonctions.push("Agent de Sécurité");
        if (emailRule.dest_serveur) fonctions.push("Serveur");

        if (fonctions.length > 0) {
          const { data: roleUsers } = await supabase
            .from("managed_users")
            .select("email")
            .eq("etablissement_id", etab.id)
            .in("fonction", fonctions);
          (roleUsers ?? []).forEach((u: any) => { if (u.email) emailSet.add(u.email); });
        }

        const recipients = Array.from(emailSet);
        if (recipients.length > 0) {
          try {
            const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
            const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";
            for (const to of recipients) {
              await resend.emails.send({
                from: FROM_EMAIL,
                to,
                subject: `[Main Courante] Rapport de soirée — ${nomEntreprise} — ${dateSoireeLabel}`,
                html: contenuHtml,
              });
            }
            emailSent = true;
          } catch (_emailErr) {
            // Email failure is non-blocking — report is already saved
          }
        }
      }

      results.push({
        etab_id: etab.id,
        nom: etab.nom,
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        email_sent: emailSent,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateSoireeStr,
        total_etablissements: etablissements.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[rapport-soiree] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
