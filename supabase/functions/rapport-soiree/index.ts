import { createClient } from "npm:@supabase/supabase-js@2";

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
      // Mode test : fenêtre de 48h glissante pour capturer les événements récents
      finSoiree = new Date(now);
      debutSoiree = new Date(now);
      debutSoiree.setUTCHours(debutSoiree.getUTCHours() - 48);
    } else {
      // Mode normal : hier 15h00 UTC → aujourd'hui 07h00 UTC
      finSoiree = new Date(now);
      finSoiree.setUTCHours(7, 0, 0, 0);
      debutSoiree = new Date(finSoiree);
      debutSoiree.setUTCDate(debutSoiree.getUTCDate() - 1);
      debutSoiree.setUTCHours(15, 0, 0, 0);
    }

    const dateSoireeStr = debutSoiree.toISOString().split("T")[0];

    // Vérifier si le rapport existe déjà (ignoré en mode test)
    const { data: existing } = await supabase
      .from("rapports_soiree")
      .select("id")
      .eq("date_soiree", dateSoireeStr)
      .maybeSingle();

    if (!isTest && existing) {
      return new Response(
        JSON.stringify({ message: "Rapport déjà généré pour cette soirée", date: dateSoireeStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer les événements de la soirée
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
      .gte("date_evenement", debutSoiree.toISOString())
      .lte("date_evenement", finSoiree.toISOString())
      .order("date_evenement", { ascending: true });

    if (evErr) throw evErr;

    // Aucun événement : pas de rapport
    if (!evenements || evenements.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun événement sur cette soirée — pas de rapport", date: dateSoireeStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agents uniques (via created_by ou created_by_email)
    const agentIds = [...new Set(evenements.map((e: any) => e.created_by).filter(Boolean))];

    // Récupérer les profils des agents
    const { data: profiles } = agentIds.length > 0 ? await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", agentIds) : { data: [] };

    const profMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      if (full) profMap[p.id] = full;
    });
    // Fallback sur created_by_email si pas de profil
    evenements.forEach((e: any) => {
      if (e.created_by && !profMap[e.created_by] && e.created_by_email) {
        profMap[e.created_by] = e.created_by_email;
      }
    });

    // Récupérer les infos entreprise
    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom, logo_url")
      .limit(1)
      .maybeSingle();

    // Stats
    const nbSSI = evenements.filter((e: any) => e.type === "ssi").length;
    const nbPersonnes = evenements.filter((e: any) => e.type !== "ssi").length;

    // Formater la date de la soirée
    const dateSoireeLabel = debutSoiree.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const heureDebut = debutSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const heureFin = finSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    // Lignes du tableau d'événements
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
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-style:italic">${e.commentaire ?? "—"}</td>
        </tr>
      `;
    }).join("");

    const logoHtml = entreprise?.logo_url
      ? `<img src="${entreprise.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
      : "";

    const nomEntreprise = entreprise?.nom ?? "Rapport de soirée";

    const contenuHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rapport de soirée — ${dateSoireeLabel}</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:760px;margin:0 auto">

    <!-- En-tête -->
    <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:36px 40px 28px">
      ${logoHtml}
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">Main Courante — Rapport automatique</p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;line-height:1.2">${nomEntreprise}</h1>
    </div>

    <!-- Sous-titre soirée -->
    <div style="background:#1e293b;padding:18px 40px">
      <p style="color:#e2e8f0;font-size:17px;font-weight:700;margin:0 0 4px">Soirée du ${dateSoireeLabel}</p>
      <p style="color:#475569;font-size:13px;margin:0">${heureDebut} → ${heureFin}</p>
    </div>

    <!-- Stats -->
    <div style="background:#f1f5f9;padding:24px 40px;display:flex;gap:16px;border-bottom:1px solid #e2e8f0">
      <div style="flex:1;background:#fff;border-radius:12px;padding:20px;text-align:center;border:1px solid #e2e8f0">
        <p style="font-size:32px;font-weight:800;color:#0f172a;margin:0">${evenements.length}</p>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0;font-weight:500">Événements</p>
      </div>
      <div style="flex:1;background:#fff;border-radius:12px;padding:20px;text-align:center;border:1px solid #e2e8f0">
        <p style="font-size:32px;font-weight:800;color:#ef4444;margin:0">${nbSSI}</p>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0;font-weight:500">SSI</p>
      </div>
      <div style="flex:1;background:#fff;border-radius:12px;padding:20px;text-align:center;border:1px solid #e2e8f0">
        <p style="font-size:32px;font-weight:800;color:#3b82f6;margin:0">${nbPersonnes}</p>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0;font-weight:500">Personnes</p>
      </div>
      <div style="flex:1;background:#fff;border-radius:12px;padding:20px;text-align:center;border:1px solid #e2e8f0">
        <p style="font-size:32px;font-weight:800;color:#10b981;margin:0">${agentIds.length}</p>
        <p style="font-size:12px;color:#64748b;margin:4px 0 0;font-weight:500">Agents</p>
      </div>
    </div>

    <!-- Tableau des événements -->
    <div style="background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden">
      <div style="padding:24px 40px 16px">
        <h2 style="font-size:15px;font-weight:700;color:#0f172a;margin:0">Journal des événements</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Type</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Espace / Zone</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Niveau</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Agent</th>
            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;text-align:left">Commentaire</th>
          </tr>
        </thead>
        <tbody>${lignesEvenements}</tbody>
      </table>

      <!-- Pied de page -->
      <div style="padding:20px 40px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
        <p style="font-size:12px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante</p>
        <p style="font-size:12px;color:#94a3b8;margin:0">${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>
    </div>

  </div>
</body>
</html>`;

    // Sauvegarder le rapport en base (upsert en mode test pour écraser l'existant)
    const { error: insertErr } = await supabase
      .from("rapports_soiree")
      .upsert({
        date_soiree: dateSoireeStr,
        debut_soiree: debutSoiree.toISOString(),
        fin_soiree: finSoiree.toISOString(),
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        contenu_html: contenuHtml,
      }, { onConflict: "date_soiree" });

    if (insertErr) throw insertErr;

    // Envoyer le rapport par e-mail via Make.com si activé
    const { data: emailSettings } = await supabase
      .from("rapport_email_settings")
      .select("email_enabled")
      .limit(1)
      .maybeSingle();

    let emailSent = false;
    if (emailSettings?.email_enabled) {
      // Récupérer tous les emails des utilisateurs avec la fonction Direction
      const { data: directionUsers } = await supabase
        .from("managed_users")
        .select("email")
        .eq("fonction", "Direction");

      const recipients = (directionUsers ?? []).map((u: any) => u.email).filter(Boolean);

      if (recipients.length > 0) {
        try {
          await fetch("https://hook.eu2.make.com/bpqpne75u61bbwd1jklhs06w2ggeekav", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: recipients,
              subject: `Rapport de soirée — ${dateSoireeLabel}`,
              html: contenuHtml,
              date_soiree: dateSoireeStr,
              nb_evenements: evenements.length,
              nb_agents: agentIds.length,
              entreprise: nomEntreprise,
            }),
          });
          emailSent = true;
        } catch (_emailErr) {
          // Email failure is non-blocking — report is already saved
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateSoireeStr,
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        email_sent: emailSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
