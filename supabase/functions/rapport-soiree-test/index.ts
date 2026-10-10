import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Convert a Paris-local date string (YYYY-MM-DD) to a UTC Date at 06:00 Paris.
 * Uses Intl to compute the correct offset (CEST +02:00 or CET +01:00).
 */
function parisStartISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parisFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(noonUTC);
  const [ph, pm] = parisFmt.split(":").map(Number);
  const offsetMin = (ph * 60 + pm) - 12 * 60;
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const oh = String(Math.floor(absMin / 60)).padStart(2, "0");
  const om = String(absMin % 60).padStart(2, "0");
  return dateStr + "T06:00:00" + sign + oh + ":" + om;
}

function parisEndISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = next.toISOString().slice(0, 10);
  return parisStartISO(nextStr);
}

/** Compute the soirée date (Paris TZ, 06:00 cutoff) from a reference Date. */
function soireeDateFrom(ref: Date): string {
  const parisParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit",
  }).formatToParts(ref);
  const map: Record<string, string> = {};
  for (const p of parisParts) { if (p.type !== "literal") map[p.type] = p.value; }
  const hour = parseInt(map.hour, 10);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  if (hour < 6) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().slice(0, 10);
  }
  return dateStr;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isCronCall) {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;

    // Default: last completed soirée (yesterday). If body.date_soiree is provided, use it.
    let dateSoireeStr: string;
    if (body?.date_soiree) {
      dateSoireeStr = body.date_soiree;
    } else {
      const now = new Date();
      const todaySoiree = soireeDateFrom(now);
      const [y, m, d] = todaySoiree.split("-").map(Number);
      const prev = new Date(Date.UTC(y, m - 1, d));
      prev.setUTCDate(prev.getUTCDate() - 1);
      dateSoireeStr = prev.toISOString().slice(0, 10);
    }

    const debutSoireeISO = parisStartISO(dateSoireeStr);
    const finSoireeISO = parisEndISO(dateSoireeStr);
    const debutSoiree = new Date(debutSoireeISO);
    const finSoiree = new Date(finSoireeISO);

    const { data: etablissements, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, logo_url, effectif_public, mode_jauge")
      .in("statut", ["essai", "actif"]);

    if (etabErr) throw etabErr;
    if (!etablissements || etablissements.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun établissement actif", date: dateSoireeStr }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const FIXED_RECIPIENT = "christopheinfo21@gmail.com";

    for (const etab of etablissements) {
      // Fetch evenements within the Paris 06:00 → 06:00 window
      const { data: evenements, error: evErr } = await supabase
        .from("evenements")
        .select(`
          id, created_at, date_evenement, type, espace_nom, zone_nom,
          niveau_label, commentaire, created_by, created_by_email, user_fonction, etablissement_nom
        `)
        .eq("etablissement_id", etab.id)
        .gte("date_evenement", debutSoireeISO)
        .lt("date_evenement", finSoireeISO)
        .order("date_evenement", { ascending: true });

      if (evErr) {
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

      const nbSSI = evenements.filter((e: any) => e.type === "ssi").length;
      const nbPersonnes = evenements.filter((e: any) => e.type !== "ssi").length;

      // --- Statistics: Visiteurs, Max en salle, Heure de pointe ---
      let totalVisiteurs = 0;
      let countMax = 0;
      let heurePointe = "—";

      const isAuto = etab.mode_jauge === "automatique";

      if (isAuto) {
        // Visiteurs = entrees_billetterie from jauge_etat
        const { data: jaugeEtat } = await supabase
          .from("jauge_etat")
          .select("entrees_billetterie, sorties_boutons, count_actuel")
          .eq("etablissement_id", etab.id)
          .eq("date_soiree", dateSoireeStr)
          .eq("is_test", false)
          .maybeSingle();

        totalVisiteurs = jaugeEtat?.entrees_billetterie ?? 0;

        // Max en salle + Heure de pointe from jauge_snapshots
        const { data: snapshots } = await supabase
          .from("jauge_snapshots")
          .select("snapshot_at, count_actuel, entrees_billetterie, sorties_boutons")
          .eq("etablissement_id", etab.id)
          .eq("date_soiree", dateSoireeStr)
          .order("snapshot_at", { ascending: true });

        if (snapshots && snapshots.length > 0) {
          // Max en salle = highest count_actuel
          for (const s of snapshots as any[]) {
            if (s.count_actuel > countMax) {
              countMax = s.count_actuel;
              heurePointe = new Date(s.snapshot_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
              }).replace(":", "h");
            }
          }

          // Heure de pointe = tranche d'1h avec le plus d'entrées
          // Group snapshots by Paris hour, compute delta in entrees_billetterie per hour
          const hourlyEntrees: Record<string, number> = {};
          let prevEntrees = snapshots[0].entrees_billetterie;
          let prevHour = new Date(snapshots[0].snapshot_at).toLocaleString("fr-FR", {
            hour: "2-digit", timeZone: "Europe/Paris", hour12: false,
          });
          for (let i = 1; i < snapshots.length; i++) {
            const s = snapshots[i] as any;
            const sHour = new Date(s.snapshot_at).toLocaleString("fr-FR", {
              hour: "2-digit", timeZone: "Europe/Paris", hour12: false,
            });
            const delta = (s.entrees_billetterie ?? 0) - prevEntrees;
            if (delta > 0) {
              hourlyEntrees[prevHour] = (hourlyEntrees[prevHour] ?? 0) + delta;
            }
            if (sHour !== prevHour) {
              prevHour = sHour;
            }
            prevEntrees = s.entrees_billetterie;
          }

          // Find the hour with the most entries
          let maxEntrees = 0;
          let maxHour = "—";
          for (const [hour, entrees] of Object.entries(hourlyEntrees)) {
            if (entrees > maxEntrees) {
              maxEntrees = entrees;
              maxHour = hour + "h";
            }
          }
          if (maxEntrees > 0) {
            heurePointe = maxHour;
          }
        }
      } else {
        // Manual mode: use jauge_actions like the original
        const { data: jaugeActions } = await supabase
          .from("jauge_actions")
          .select("action, delta, created_at")
          .eq("etablissement_id", etab.id)
          .gte("created_at", debutSoireeISO)
          .lt("created_at", finSoireeISO)
          .order("created_at", { ascending: true });

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
              hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
            }).replace(":", "h");
          }
        }
      }

      // --- Date/heure labels in Paris TZ ---
      const parisOpts: Intl.DateTimeFormatOptions = { timeZone: "Europe/Paris" };
      const dateSoireeLabel = debutSoiree.toLocaleDateString("fr-FR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric", ...parisOpts,
      });
      const heureDebut = debutSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", ...parisOpts });
      const heureFin = finSoiree.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", ...parisOpts });

      // --- Event cards (one div per event, mobile-friendly) ---
      const cartesEvenements = evenements.map((e: any) => {
        const heure = new Date(e.date_evenement).toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
        });
        const agent = profMap[e.created_by] ?? e.created_by_email ?? "Inconnu";
        const typeColor =
          e.type === "ssi" ? "#ef4444" :
          e.type === "securite_personnes" ? "#3b82f6" :
          e.type === "radio" ? "#10b981" : "#f59e0b";
        const typeLabel =
          e.type === "ssi" ? "SSI" :
          e.type === "securite_personnes" ? "Sécurité" :
          e.type === "radio" ? "Radio" : (e.type ?? "—");
        const localisation = e.espace_nom ?? "—";
        const zoneTxt = e.zone_nom ? ` / ${e.zone_nom}` : "";
        const commentaireTxt = e.commentaire ? e.commentaire.replace(/</g, "&lt;") : "—";

        return `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
          <div style="font-size:13px;margin-bottom:6px;">
            <span style="font-weight:700;color:#0f172a;">${heure}</span>
            <span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;color:${typeColor};background:${typeColor}18;margin-left:8px;">${typeLabel}</span>
            <span style="color:#64748b;font-size:12px;margin-left:8px;">${e.niveau_label ?? "—"}</span>
          </div>
          <div style="font-size:13px;color:#374151;margin-bottom:6px;">
            ${localisation}${zoneTxt ? ` <span style="color:#9ca3af">${zoneTxt}</span>` : ""}
            <span style="color:#9ca3af;margin-left:6px;">— ${agent}</span>
          </div>
          <div style="font-size:13px;color:#6b7280;font-style:italic;line-height:1.4;">${commentaireTxt}</div>
        </div>`;
      }).join("");

      const logoHtml = etab.logo_url
        ? `<img src="${etab.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
        : "";
      const nomEntreprise = etab.nom ?? "Rapport de soirée";

      // --- Statistics: 3 cards per row ---
      const statCard = (value: string | number, label: string, color: string) => `
        <div style="display:inline-block;width:31%;vertical-align:top;margin:0 1%;background:#ffffff;border-radius:10px;padding:14px 8px;text-align:center;box-sizing:border-box;">
          <div style="font-size:24px;font-weight:700;color:${color};line-height:1;">${value}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:5px;">${label}</div>
        </div>`;

      const contenuHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rapport de soirée — ${dateSoireeLabel}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto">

    <!-- En-tête -->
    <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 24px 22px;">
      ${logoHtml}
      <p style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">Main Courante — Rapport de soirée</p>
      <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;line-height:1.2">${nomEntreprise}</h1>
    </div>

    <!-- Sous-titre soirée -->
    <div style="background:#1e293b;padding:14px 24px;">
      <p style="color:#e2e8f0;font-size:16px;font-weight:700;margin:0 0 4px">Soirée du ${dateSoireeLabel}</p>
      <p style="color:#475569;font-size:12px;margin:0">${heureDebut} → ${heureFin} (heure de Paris)</p>
    </div>

    <!-- Stats: 3 cards per row, two rows -->
    <div style="background:#f1f5f9;padding:16px 12px;border-bottom:1px solid #e2e8f0;">
      <div style="margin-bottom:8px;">
        ${statCard(evenements.length, "Événements", "#1e293b")}
        ${statCard(nbSSI, "SSI", "#ef4444")}
        ${statCard(nbPersonnes, "Sécurité", "#3b82f6")}
      </div>
      <div style="margin-bottom:8px;">
        ${statCard(agentIds.length, "Agents", "#22c55e")}
        ${statCard(totalVisiteurs, "Visiteurs", "#22c55e")}
        ${statCard(countMax, "Max en salle", "#f59e0b")}
      </div>
      <div>
        ${statCard(heurePointe, "Heure de pointe", "#60a5fa")}
      </div>
    </div>

    <!-- Cartes des événements -->
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:18px 16px 14px;">
      <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px">Journal des événements</h2>
      ${cartesEvenements}
    </div>

    <!-- Pied de page -->
    <div style="padding:16px 0;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante (version test)</p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" })}</p>
    </div>

  </div>
</body>
</html>`;

      // --- Save to rapports_soiree (upsert, same table) ---
      const { error: insertErr } = await supabase
        .from("rapports_soiree")
        .upsert({
          date_soiree: dateSoireeStr,
          etablissement_id: etab.id,
          debut_soiree: debutSoireeISO,
          fin_soiree: finSoireeISO,
          nb_evenements: evenements.length,
          nb_agents: agentIds.length,
          contenu_html: contenuHtml,
        }, { onConflict: "etablissement_id,date_soiree" });

      if (insertErr) {
        console.error(`[rapport-soiree-test] upsert error for ${etab.nom}:`, insertErr.message);
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: `upsert_error: ${insertErr.message}` });
        continue;
      }

      // --- Send email to the fixed test recipient only ---
      let emailSent = false;
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";
        await resend.emails.send({
          from: FROM_EMAIL,
          to: FIXED_RECIPIENT,
          subject: `[TEST] Rapport de soirée — ${nomEntreprise} — ${dateSoireeLabel}`,
          html: contenuHtml,
        });
        emailSent = true;
      } catch (emailErr: unknown) {
        console.error(`[rapport-soiree-test] email send failed:`, emailErr);
      }

      results.push({
        etab_id: etab.id,
        nom: etab.nom,
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        email_sent: emailSent,
        recipient: FIXED_RECIPIENT,
        totalVisiteurs,
        countMax,
        heurePointe,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      date: dateSoireeStr,
      window: `${debutSoireeISO} → ${finSoireeISO}`,
      total_etablissements: etablissements.length,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    console.error("[rapport-soiree-test] unhandled error:", err);
    return new Response(JSON.stringify({ error: "An error occurred processing your request." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
