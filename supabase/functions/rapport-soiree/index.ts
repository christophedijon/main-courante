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

    // Fenêtre de la soirée : hier 15h00 → aujourd'hui 07h00 (heure locale Europe/Paris)
    // On travaille en UTC et on applique un offset de -2h (CEST) ou -1h (CET)
    // La fonction tourne à 8h00 UTC, donc "aujourd'hui" = jour courant UTC
    const now = new Date();

    const finSoiree = new Date(now);
    finSoiree.setUTCHours(7, 0, 0, 0); // aujourd'hui 07:00 UTC

    const debutSoiree = new Date(finSoiree);
    debutSoiree.setUTCDate(debutSoiree.getUTCDate() - 1);
    debutSoiree.setUTCHours(15, 0, 0, 0); // hier 15:00 UTC

    const dateSoireeStr = debutSoiree.toISOString().split("T")[0]; // "2026-05-05"

    // Vérifier si le rapport existe déjà
    const { data: existing } = await supabase
      .from("rapports_soiree")
      .select("id")
      .eq("date_soiree", dateSoireeStr)
      .maybeSingle();

    if (existing) {
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
        type_evenement,
        espace,
        zone,
        niveau,
        commentaire,
        user_id
      `)
      .gte("created_at", debutSoiree.toISOString())
      .lte("created_at", finSoiree.toISOString())
      .order("created_at", { ascending: true });

    if (evErr) throw evErr;

    // Aucun événement : pas de rapport
    if (!evenements || evenements.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun événement sur cette soirée — pas de rapport", date: dateSoireeStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agents uniques
    const agentIds = [...new Set(evenements.map((e: any) => e.user_id).filter(Boolean))];

    // Récupérer les profils des agents
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", agentIds);

    const { data: managedUsers } = await supabase
      .from("managed_users")
      .select("auth_user_id, email")
      .in("auth_user_id", agentIds);

    const profMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: any) => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      if (full) profMap[p.id] = full;
    });
    (managedUsers ?? []).forEach((mu: any) => {
      if (!profMap[mu.auth_user_id]) profMap[mu.auth_user_id] = mu.email;
    });

    // Récupérer les infos entreprise
    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom, logo_url")
      .limit(1)
      .maybeSingle();

    // Stats
    const nbSSI = evenements.filter((e: any) => e.type_evenement === "SSI").length;
    const nbPersonnes = evenements.filter((e: any) => e.type_evenement !== "SSI").length;

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
      const heure = new Date(e.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const agent = profMap[e.user_id] ?? "Inconnu";
      const typeColor =
        e.type_evenement === "SSI" ? "#ef4444" :
        e.type_evenement === "RONDE" ? "#3b82f6" :
        e.type_evenement === "RADIO" ? "#10b981" : "#f59e0b";

      return `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 16px;font-size:13px;color:#64748b;white-space:nowrap">${heure}</td>
          <td style="padding:12px 16px">
            <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${typeColor};background:${typeColor}18">
              ${e.type_evenement ?? "—"}
            </span>
          </td>
          <td style="padding:12px 16px;font-size:13px;color:#374151">
            ${e.espace ?? "—"}${e.zone ? ` <span style="color:#9ca3af">/ ${e.zone}</span>` : ""}
          </td>
          <td style="padding:12px 16px;font-size:13px;color:#374151">${e.niveau ?? "—"}</td>
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

    // Sauvegarder le rapport en base
    const { error: insertErr } = await supabase
      .from("rapports_soiree")
      .insert({
        date_soiree: dateSoireeStr,
        debut_soiree: debutSoiree.toISOString(),
        fin_soiree: finSoiree.toISOString(),
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        contenu_html: contenuHtml,
      });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        date: dateSoireeStr,
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
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
