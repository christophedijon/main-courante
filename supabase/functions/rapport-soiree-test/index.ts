import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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

const STATUTS_ELIGIBLES = ["essai", "actif"];

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

const HEURE_MS = 60 * 60 * 1000;
const PIC_MIN_INSTANTANES = 10;
const SAUT_SEUIL_ENTREES = 100;
const SAUT_INTERVALLE_MS = 4 * 60 * 1000;

function heureCourte(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

function calculerPic(points: { t: number; e: number }[]): { plage: string; entrees: number } | null {
  if (points.length < PIC_MIN_INSTANTANES) return null;
  const finDernier = points[points.length - 1].t;
  let meilleur: { debut: number; entrees: number } | null = null;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    const fin = points[i].t + HEURE_MS;
    if (fin > finDernier) break;
    while (j + 1 < points.length && points[j + 1].t <= fin) j++;
    const entrees = points[j].e - points[i].e;
    if (!meilleur || entrees > meilleur.entrees) meilleur = { debut: points[i].t, entrees };
  }
  if (!meilleur) return null;
  const versHeure = (t: number) => heureCourte(new Date(t).toISOString()).replace(":", "h");
  return {
    plage: `${versHeure(meilleur.debut)} - ${versHeure(meilleur.debut + HEURE_MS)}`,
    entrees: meilleur.entrees,
  };
}

function detecterSaut(points: { t: number; e: number }[]): string | null {
  for (let i = 1; i < points.length; i++) {
    const ecart = points[i].e - points[i - 1].e;
    if (ecart > SAUT_SEUIL_ENTREES && points[i].t - points[i - 1].t <= SAUT_INTERVALLE_MS) {
      return heureCourte(new Date(points[i].t).toISOString());
    }
  }
  return null;
}

async function evaluerSoiree(
  supabase: SupabaseClient,
  etab: any,
  evenements: any[],
  rule: any,
  dateSoireeStr: string,
  debutISO: string,
  finISO: string,
) {
  const { data: jaugeEtat, error: jaugeErr } = await supabase
    .from("jauge_etat")
    .select("entrees_billetterie")
    .eq("etablissement_id", etab.id)
    .eq("date_soiree", dateSoireeStr)
    .eq("is_test", false)
    .maybeSingle();
  if (jaugeErr) throw jaugeErr;

  let visiteurs = 0;
  if (etab.mode_jauge === "automatique") {
    visiteurs = jaugeEtat?.entrees_billetterie ?? 0;
  } else {
    const { data: entrees, error: entreesErr } = await supabase
      .from("jauge_actions")
      .select("delta")
      .eq("etablissement_id", etab.id)
      .eq("action", "entree")
      .gte("created_at", debutISO)
      .lt("created_at", finISO);
    if (entreesErr) throw entreesErr;
    visiteurs = (entrees ?? []).reduce((sum: number, a: any) => sum + (a.delta ?? 0), 0);
  }

  const nbEvenements = evenements.length;
  const envoyer = nbEvenements >= 1 || visiteurs > 1;
  const motif = nbEvenements >= 1
    ? "au moins 1 événement"
    : visiteurs > 1 ? "plus d'un visiteur" : "aucune activité";

  const destinataires = new Set<string>((rule.dest_emails_libres ?? []).filter(Boolean));
  const fonctions: string[] = [];
  if (rule.dest_direction) fonctions.push("Direction");
  if (rule.dest_chef_de_poste) fonctions.push("Chef de Poste");
  if (rule.dest_agent_securite) fonctions.push("Agent de Sécurité");
  if (rule.dest_serveur) fonctions.push("Serveur");
  if (fonctions.length > 0) {
    const { data: roleUsers, error: usersErr } = await supabase
      .from("managed_users")
      .select("email")
      .eq("etablissement_id", etab.id)
      .in("fonction", fonctions);
    if (usersErr) throw usersErr;
    (roleUsers ?? []).forEach((u: any) => { if (u.email) destinataires.add(u.email); });
  }

  return {
    nbEvenements,
    visiteurs,
    envoyer,
    motif,
    destinataires: Array.from(destinataires),
  };
}

type Tendance = "hausse" | "stable" | "baisse";
type TendancesSoiree = { etablissement: Tendance | null; reseau: Tendance | null };

const TENDANCES_VALIDES: string[] = ["hausse", "stable", "baisse"];
const TENDANCE_RENDU: Record<Tendance, { symbole: string; libelle: string; couleur: string }> = {
  hausse: { symbole: "▲", libelle: "Hausse", couleur: "#15803d" },
  stable: { symbole: "▶", libelle: "Stable", couleur: "#475569" },
  baisse: { symbole: "▼", libelle: "Baisse", couleur: "#c2410c" },
};

function valideTendancesSimulees(valeur: any): boolean {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return false;
  return Object.entries(valeur).every(([cle, v]) =>
    (cle === "etablissement" || cle === "reseau") && TENDANCES_VALIDES.includes(v as string)
  );
}

function jourComparaison(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 7)).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });
}

function htmlTendanceVisiteurs(tendance: Tendance | null, dateSoiree: string): string {
  if (!tendance) return `<div style="font-size:11px;color:#64748b;margin-top:6px;">Pas de comparaison</div>`;
  const r = TENDANCE_RENDU[tendance];
  return `<div style="font-size:12px;font-weight:700;color:${r.couleur};margin-top:6px;">${r.symbole} ${r.libelle}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">vs ${jourComparaison(dateSoiree)} dernier</div>`;
}

function htmlTendanceReseau(tendance: Tendance | null, desactive: boolean): string {
  if (desactive) return `<p style="font-size:11px;color:#64748b;margin:10px 0 0;">Comparatif réseau désactivé</p>`;
  if (!tendance) return "";
  const r = TENDANCE_RENDU[tendance];
  return `<p style="font-size:12px;font-weight:700;color:${r.couleur};margin:10px 0 0;">Réseau ${r.symbole} ${r.libelle}</p>`;
}

async function calculerTendances(
  supabase: SupabaseClient,
  etabId: string,
  dateSoiree: string,
  simulees: Partial<TendancesSoiree> | null,
): Promise<{ tendances: TendancesSoiree; erreur: string | null }> {
  const aucune: TendancesSoiree = { etablissement: null, reseau: null };
  const { error: calculErr } = await supabase.rpc("compute_stats_soiree", {
    p_etablissement_id: etabId,
    p_date_soiree: dateSoiree,
  });
  if (calculErr) return { tendances: aucune, erreur: `compute_stats_soiree: ${calculErr.message}` };

  const [etabRes, reseauRes] = await Promise.all([
    supabase.rpc("tendance_etablissement", { p_etablissement_id: etabId, p_date_soiree: dateSoiree }),
    supabase.rpc("tendance_reseau", { p_etablissement_id: etabId, p_date_soiree: dateSoiree }),
  ]);
  const erreurs: string[] = [];
  if (etabRes.error) erreurs.push(`tendance_etablissement: ${etabRes.error.message}`);
  if (reseauRes.error) erreurs.push(`tendance_reseau: ${reseauRes.error.message}`);

  return {
    tendances: {
      etablissement: simulees?.etablissement ?? (etabRes.error ? null : (etabRes.data as Tendance | null)),
      reseau: simulees?.reseau ?? (reseauRes.error ? null : (reseauRes.data as Tendance | null)),
    },
    erreur: erreurs.length > 0 ? erreurs.join(" ; ") : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;
    const dryRun = body?.dry_run === true;
    const tendancesSimulees = body?.tendances_simulees ?? null;
    if (tendancesSimulees !== null && !valideTendancesSimulees(tendancesSimulees)) {
      return new Response(JSON.stringify({ error: "tendances_simulees non autorisé ou invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: tousEtablissements, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, logo_url, effectif_public, mode_jauge, statut, barometre_participe");

    if (etabErr) throw etabErr;
    const etablissements = (tousEtablissements ?? []).filter((e: any) => STATUTS_ELIGIBLES.includes(e.statut));
    const statutsIgnores = (tousEtablissements ?? [])
      .filter((e: any) => !STATUTS_ELIGIBLES.includes(e.statut))
      .map((e: any) => ({ nom: e.nom, statut: e.statut }));
    if (etablissements.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun établissement actif", date: dateSoireeStr }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const FIXED_RECIPIENT = "christopheinfo21@gmail.com";

    for (const etab of etablissements) {
      const { data: rule, error: ruleErr } = await supabase
        .from("email_rules")
        .select("*")
        .eq("type", "rapport_soiree")
        .eq("etablissement_id", etab.id)
        .limit(1)
        .maybeSingle();

      if (ruleErr) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: `regle_error: ${ruleErr.message}` });
        continue;
      }
      if (!rule?.active) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: "regle_inactive" });
        continue;
      }

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

      const evaluation = await evaluerSoiree(supabase, etab, evenements ?? [], rule, dateSoireeStr, debutSoireeISO, finSoireeISO);
      if (dryRun || !evaluation.envoyer) {
        results.push({
          etab_id: etab.id,
          nom: etab.nom,
          date_soiree: dateSoireeStr,
          nb_evenements: evaluation.nbEvenements,
          visiteurs: evaluation.visiteurs,
          decision: evaluation.envoyer ? "envoyer" : "ne_pas_envoyer",
          motif: evaluation.motif,
          nb_destinataires: evaluation.destinataires.length,
          destinataires: evaluation.destinataires.map(maskEmail),
        });
        continue;
      }

      const { tendances, erreur: tendancesErreur } = await calculerTendances(supabase, etab.id, dateSoireeStr, tendancesSimulees);

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

      // --- Statistics: Visiteurs, Pic d'arrivées ---
      const totalVisiteurs = evaluation.visiteurs;
      let pic: { plage: string; entrees: number } | null = null;
      let noteSaut: string | null = null;

      if (etab.mode_jauge === "automatique") {
        const { data: snapshots } = await supabase
          .from("jauge_snapshots")
          .select("snapshot_at, entrees_billetterie")
          .eq("etablissement_id", etab.id)
          .eq("date_soiree", dateSoireeStr)
          .order("snapshot_at", { ascending: true });

        const points = ((snapshots ?? []) as any[]).map((s) => ({
          t: new Date(s.snapshot_at).getTime(),
          e: s.entrees_billetterie ?? 0,
        }));
        pic = calculerPic(points);
        noteSaut = detecterSaut(points);
      }

      const picValeur = pic
        ? `${pic.plage}<div style="font-size:11px;font-weight:500;color:#64748b;margin-top:4px;">${pic.entrees} ${pic.entrees > 1 ? "entrées" : "entrée"}</div>`
        : "—";

      // --- Date/heure labels in Paris TZ ---
      const parisOpts: Intl.DateTimeFormatOptions = { timeZone: "Europe/Paris" };
      const dateSoireeLabel = debutSoiree.toLocaleDateString("fr-FR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric", ...parisOpts,
      });

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
      const visiteursTendance = htmlTendanceVisiteurs(tendances.etablissement, dateSoireeStr);
      const reseauLigne = htmlTendanceReseau(tendances.reseau, etab.barometre_participe === false);

      const statCell = (value: string | number, label: string, color: string, width: string, dessous = "") => `
        <td width="${width}" valign="top" style="width:${width};padding:0 2px;">
          <div style="background:#ffffff;border-radius:10px;padding:12px 4px;text-align:center;">
            <div class="stat-value" style="font-size:22px;font-weight:700;color:${color};line-height:1.1;">${value}</div>${dessous}
            <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.3;">${label}</div>
          </div>
        </td>`;

      const contenuHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <style>
    @media (min-width: 600px) {
      .stat-value { font-size: 28px !important; }
      .stat-label { font-size: 12px !important; }
    }
  </style>
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
    </div>

    <!-- Stats: Fréquentation (3 cartes) -->
    <div style="background:#f1f5f9;padding:16px 12px 14px;border-bottom:1px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;">Fréquentation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${statCell(totalVisiteurs, "Visiteurs", "#22c55e", "50%", visiteursTendance)}
          ${statCell(picValeur, "Pic d'arrivées", "#60a5fa", "50%")}
        </tr>
      </table>
      ${reseauLigne}
      ${noteSaut ? `<p style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:8px;padding:8px 10px;margin:10px 0 0;">Relevé billetterie interrompu puis rétabli vers ${noteSaut}, le rythme d'arrivées avant cette heure peut être sous-estimé.</p>` : ""}
    </div>

    <!-- Stats: Activité (4 cartes) -->
    <div style="background:#f1f5f9;padding:0 12px 16px;border-bottom:1px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;">Activité</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${statCell(evenements.length, "Événements", "#1e293b", "25%")}
          ${statCell(nbSSI, "SSI", "#ef4444", "25%")}
          ${statCell(nbPersonnes, "Sécu", "#3b82f6", "25%")}
          ${statCell(agentIds.length, "Agents", "#22c55e", "25%")}
        </tr>
      </table>
    </div>

    <!-- Cartes des événements -->
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:18px 16px 14px;">
      <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px">Journal des événements</h2>
      ${evenements.length === 0 ? `<p style="font-size:13px;color:#64748b;margin:0;">Aucun événement</p>` : cartesEvenements}
    </div>

    <!-- Pied de page -->
    <div style="padding:16px 0;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante (version test)</p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" })}</p>
      <p style="font-size:11px;color:#94a3b8;margin:8px 0 0"><a href="mailto:contact@maincourante.eu?subject=Désinscription%20rapport%20de%20soirée" style="color:#94a3b8;text-decoration:underline;">Se désinscrire du rapport de soirée</a></p>
    </div>

  </div>
</body>
</html>`;

      // --- Send email to the fixed test recipient only (no DB write) ---
      let emailSent = false;
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";
        await resend.emails.send({
          from: FROM_EMAIL,
          to: FIXED_RECIPIENT,
          replyTo: "contact@maincourante.eu",
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
        pic,
        noteSaut,
        tendances_erreur: tendancesErreur,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      date: dateSoireeStr,
      window: `${debutSoireeISO} → ${finSoireeISO}`,
      total_etablissements: etablissements.length,
      dry_run: dryRun,
      statuts_ignores: statutsIgnores,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    console.error("[rapport-soiree-test] unhandled error:", err);
    return new Response(JSON.stringify({ error: "An error occurred processing your request." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
