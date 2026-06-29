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
    const { entreprise_id, session_opened_at } = body as {
      entreprise_id?: string;
      session_opened_at?: string;
    };

    // Resolve entreprise
    const entQuery = entreprise_id
      ? supabase.from("etablissements").select("id, nom, logo_url, force_session_active, force_session_type, force_session_opened_at").eq("id", entreprise_id).single()
      : supabase.from("etablissements").select("id, nom, logo_url, force_session_active, force_session_type, force_session_opened_at").in("statut", ["essai", "actif"]).order("enseigne", { ascending: true, nullsFirst: false }).limit(1).maybeSingle();

    const { data: entreprise, error: entErr } = await entQuery;
    if (entErr || !entreprise) {
      return new Response(JSON.stringify({ error: "entreprise not found" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Guard: only send if the test session is still marked active
    if (!entreprise.force_session_active || entreprise.force_session_type !== "test") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "test session already closed or not active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const closedAt = new Date();
    const openedAt = session_opened_at
      ? new Date(session_opened_at)
      : (entreprise.force_session_opened_at ? new Date(entreprise.force_session_opened_at) : new Date(closedAt.getTime() - 3600_000));

    // Read test jauge_actions (is_test = true) in session window
    const { data: jaugeActions } = await supabase
      .from("jauge_actions")
      .select("action, delta, created_at, source")
      .eq("entreprise_id", entreprise.id)
      .eq("is_test", true)
      .gte("created_at", openedAt.toISOString())
      .lte("created_at", closedAt.toISOString())
      .order("created_at", { ascending: true });

    // Compute peak count (entrées_max) from action log
    let running = 0;
    let entreesMax = 0;
    let totalEntrees = 0;
    let heurePointe = "—";
    let heurePointeDate: Date | null = null;

    for (const a of (jaugeActions ?? []) as any[]) {
      running = Math.max(0, running + (a.delta ?? 0));
      if (a.action === "entree") totalEntrees += Math.abs(a.delta ?? 0);
      if (running > entreesMax) {
        entreesMax = running;
        heurePointeDate = new Date(a.created_at);
      }
    }

    if (heurePointeDate) {
      heurePointe = heurePointeDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
      }).replace(":", "h");
    }

    // Read events created during test session window
    const { data: evenements } = await supabase
      .from("evenements")
      .select("id, date_evenement, type, espace_nom, zone_nom, niveau_label, commentaire, created_by, created_by_email")
      .gte("date_evenement", openedAt.toISOString())
      .lte("date_evenement", closedAt.toISOString())
      .order("date_evenement", { ascending: true });

    const nbSSI = (evenements ?? []).filter((e: any) => e.type === "ssi").length;
    const nbGestionClient = (evenements ?? []).filter((e: any) => e.type !== "ssi").length;
    const nbActions = (jaugeActions ?? []).length;

    // Format dates
    const ouvertureLabel = openedAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
    }).replace(":", "h");
    const fermetureLabel = closedAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
    }).replace(":", "h");
    const dateLabel = openedAt.toLocaleDateString("fr-FR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris",
    });

    const logoHtml = entreprise.logo_url
      ? `<img src="${entreprise.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
      : "";

    const nomEntreprise = entreprise.nom ?? "Main Courante";

    // Actions table rows
    const lignesActions = (jaugeActions ?? []).length === 0
      ? `<tr><td colspan="3" style="padding:20px 16px;text-align:center;color:#94a3b8;font-size:13px;">Aucune action Flic enregistrée</td></tr>`
      : (jaugeActions as any[]).map((a: any) => {
          const heure = new Date(a.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
          const actionColor = a.action === "entree" ? "#22c55e" : a.action === "sortie" ? "#f59e0b" : "#64748b";
          const actionLabel = a.action === "entree" ? "Entrée" : a.action === "sortie" ? "Sortie" : "Reset";
          const deltaStr = a.delta > 0 ? `+${a.delta}` : `${a.delta}`;
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap">${heure}</td>
            <td style="padding:10px 16px">
              <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${actionColor};background:${actionColor}18">${actionLabel}</span>
            </td>
            <td style="padding:10px 16px;font-size:13px;color:#374151;font-weight:600">${deltaStr}</td>
            <td style="padding:10px 16px;font-size:12px;color:#94a3b8">${a.source ?? "app"}</td>
          </tr>`;
        }).join("");

    const lignesEvenements = (evenements ?? []).length === 0
      ? `<tr><td colspan="3" style="padding:20px 16px;text-align:center;color:#94a3b8;font-size:13px;">Aucun événement saisi</td></tr>`
      : (evenements as any[]).map((e: any) => {
          const heure = new Date(e.date_evenement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
          const typeColor = e.type === "ssi" ? "#ef4444" : "#3b82f6";
          const typeLabel = e.type === "ssi" ? "SSI" : "Gestion client";
          return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:10px 16px;font-size:13px;color:#64748b;white-space:nowrap">${heure}</td>
            <td style="padding:10px 16px">
              <span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700;color:${typeColor};background:${typeColor}18">${typeLabel}</span>
            </td>
            <td style="padding:10px 16px;font-size:13px;color:#374151">${e.espace_nom ?? "—"}${e.zone_nom ? ` / ${e.zone_nom}` : ""}</td>
          </tr>`;
        }).join("");

    const contenuHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Rapport SESSION TEST — ${dateLabel}</title></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:720px;margin:0 auto">

    <!-- En-tête TEST -->
    <div style="background:#78350f;border-radius:16px 16px 0 0;padding:36px 40px 28px">
      ${logoHtml}
      <p style="color:#fcd34d;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">
        ⚠ SESSION DE TEST — Données non opérationnelles
      </p>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;line-height:1.2">${nomEntreprise}</h1>
    </div>

    <!-- Sous-titre -->
    <div style="background:#92400e;padding:18px 40px">
      <p style="color:#fef3c7;font-size:17px;font-weight:700;margin:0 0 4px">Session test du ${dateLabel}</p>
      <p style="color:#d97706;font-size:13px;margin:0">${ouvertureLabel} → ${fermetureLabel} — durée : ${Math.round((closedAt.getTime() - openedAt.getTime()) / 60000)} min</p>
    </div>

    <!-- Stats -->
    <div style="background:#fffbeb;padding:20px 40px;border-bottom:1px solid #fde68a">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="25%" style="padding:4px">
            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a">
              <tr><td>
                <div style="color:#92400e;font-size:26px;font-weight:700;line-height:1">${entreesMax}</div>
                <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Max en salle</div>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding:4px">
            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a">
              <tr><td>
                <div style="color:#78350f;font-size:26px;font-weight:700;line-height:1">${totalEntrees}</div>
                <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Total entrées</div>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding:4px">
            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid ${nbSSI > 0 ? "#fca5a5" : "#fde68a"}">
              <tr><td>
                <div style="color:${nbSSI > 0 ? "#ef4444" : "#78350f"};font-size:26px;font-weight:700;line-height:1">${nbSSI}</div>
                <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Événements SSI</div>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding:4px">
            <table width="100%" cellpadding="14" cellspacing="0" border="0" style="background:#fff;border-radius:12px;text-align:center;border:1px solid #fde68a">
              <tr><td>
                <div style="color:${nbGestionClient > 0 ? "#3b82f6" : "#78350f"};font-size:26px;font-weight:700;line-height:1">${nbGestionClient}</div>
                <div style="color:#78350f;font-size:11px;margin-top:5px;font-weight:600">Gestion client</div>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#92400e;text-align:center">
        Heure de pointe : <strong>${heurePointe}</strong> — ${nbActions} actions Flic enregistrées
      </p>
    </div>

    <!-- Actions Flic -->
    <div style="background:#ffffff;border-top:1px solid #fde68a">
      <div style="padding:20px 40px 12px">
        <h2 style="font-size:14px;font-weight:700;color:#92400e;margin:0">Journal actions Flic (test)</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#fffbeb;border-bottom:2px solid #fde68a">
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Action</th>
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Delta</th>
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Source</th>
          </tr>
        </thead>
        <tbody>${lignesActions}</tbody>
      </table>
    </div>

    <!-- Événements -->
    <div style="background:#ffffff;border-top:1px solid #f1f5f9;border-radius:0 0 16px 16px;overflow:hidden">
      <div style="padding:20px 40px 12px">
        <h2 style="font-size:14px;font-weight:700;color:#92400e;margin:0">Événements saisis (test)</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#fffbeb;border-bottom:2px solid #fde68a">
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Heure</th>
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Type</th>
            <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#78350f;text-transform:uppercase;letter-spacing:.06em;text-align:left">Localisation</th>
          </tr>
        </thead>
        <tbody>${lignesEvenements}</tbody>
      </table>

      <div style="padding:18px 40px;border-top:1px solid #fde68a;background:#fffbeb">
        <p style="font-size:12px;color:#92400e;margin:0;font-weight:600">
          ⚠ Ces données de test ont été purgées automatiquement — elles ne figurent pas dans les rapports de soirée.
        </p>
        <p style="font-size:11px;color:#b45309;margin:4px 0 0">
          Généré le ${closedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} à ${fermetureLabel}
        </p>
      </div>
    </div>

  </div>
</body>
</html>`;

    // Send via Make.com webhook (same as rapport-soiree)
    const { data: emailRule } = await supabase
      .from("email_rules")
      .select("*")
      .eq("type", "rapport_soiree")
      .limit(1)
      .maybeSingle();

    let emailSent = false;
    if (emailRule?.active) {
      const emailSet = new Set<string>((emailRule.dest_emails_libres ?? []).filter(Boolean));
      const fonctions: string[] = [];
      if (emailRule.dest_direction) fonctions.push("Direction");
      if (emailRule.dest_chef_de_poste) fonctions.push("Chef de Poste");

      if (fonctions.length > 0) {
        const { data: roleUsers } = await supabase
          .from("managed_users")
          .select("email")
          .in("fonction", fonctions);
        (roleUsers ?? []).forEach((u: any) => { if (u.email) emailSet.add(u.email); });
      }

      const recipients = Array.from(emailSet);
      if (recipients.length > 0) {
        try {
          await fetch("https://hook.eu2.make.com/7g0h9yj07m25am6l5gtpvzbd12mkspbt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: recipients,
              sujet: `[TEST] Rapport session test — ${dateLabel} ${ouvertureLabel}→${fermetureLabel}`,
              html: contenuHtml,
            }),
          });
          emailSent = true;
        } catch (_e) {
          // non-blocking
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        stats: { entreesMax, totalEntrees, nbSSI, nbGestionClient, nbActions },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[rapport-session-test] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
