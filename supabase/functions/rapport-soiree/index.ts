import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STATUTS_ELIGIBLES = ["essai", "actif"];
const DESTINATAIRES_TEST_AUTORISES = ["christopheinfo21@gmail.com", "christophelemesnil@gmail.com"];
const HEURE_ENVOI_MIN = 8;
const PAUSE_ENTRE_ENVOIS_MS = 600;
const REPLY_TO = "contact@maincourante.eu";
const LIEN_DESINSCRIPTION = "mailto:contact@maincourante.eu?subject=D%C3%A9sinscription%20rapport%20de%20soir%C3%A9e";
const COLONNES_EVENEMENTS = `
  id, created_at, date_evenement, type, espace_nom, zone_nom,
  niveau_label, commentaire, created_by, created_by_email, user_fonction, etablissement_nom
`;

type Statistiques = {
  totalVisiteurs: number;
  pic: { plage: string; entrees: number } | null;
  noteSaut: string | null;
};

const HEURE_MS = 60 * 60 * 1000;
const PIC_MIN_INSTANTANES = 10;
const SAUT_SEUIL_ENTREES = 100;
const SAUT_INTERVALLE_MS = 4 * 60 * 1000;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parisAtISO(dateStr: string, hhmm: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const midi = new Date(Date.UTC(y, m - 1, d, 12));
  const heure = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(midi);
  const [ph, pm] = heure.split(":").map(Number);
  const offsetMin = ph * 60 + pm - 12 * 60;
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${dateStr}T${hhmm}:00${sign}${oh}:${om}`;
}

function ajouterJours(dateStr: string, jours: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + jours)).toISOString().slice(0, 10);
}

function dateParis(ref: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(ref);
}

function heureParis(ref: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23",
  }).format(ref));
}

function heureCourte(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DecisionRapport = "absent" | "reprise" | "ignore";

// Avant cette date le journal d'envois n'existait pas : un rapport sans ligne est alors un ancien rapport.
const REPRISE_DEPUIS = new Date("2026-10-31T00:00:00Z");

function decisionRapportExistant(rapport: { created_at: string }, statuts: string[]): DecisionRapport {
  if (statuts.includes("envoye")) return "ignore";
  if (statuts.length > 0) return "reprise";
  return new Date(rapport.created_at) >= REPRISE_DEPUIS ? "reprise" : "ignore";
}

function evaluerRegle(nbEvenements: number, visiteurs: number) {
  const envoyer = nbEvenements >= 1 || visiteurs > 1;
  const motif = nbEvenements >= 1
    ? "au moins 1 événement"
    : visiteurs > 1 ? "plus d'un visiteur" : "aucune activité";

  return { envoyer, motif };
}

function calculerPic(points: { t: number; e: number }[]): Statistiques["pic"] {
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

async function resoudreDestinataires(supabase: SupabaseClient, etab: any, rule: any): Promise<string[]> {
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

  return Array.from(destinataires);
}

function heureParisHhMm(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}h${m}`;
}

async function calculerJaugeMaximale(
  supabase: SupabaseClient,
  etab: any,
  dateSoireeStr: string,
): Promise<{ max: number; heure: string } | null> {
  const { data: jaugeEtat, error: jaugeErr } = await supabase
    .from("jauge_etat")
    .select("sorties_boutons")
    .eq("etablissement_id", etab.id)
    .eq("date_soiree", dateSoireeStr)
    .eq("is_test", false)
    .maybeSingle();
  if (jaugeErr) throw jaugeErr;
  if ((jaugeEtat?.sorties_boutons ?? 0) <= 1) return null;

  const { data: snapshots, error: snapErr } = await supabase
    .from("jauge_snapshots")
    .select("snapshot_at, count_actuel")
    .eq("etablissement_id", etab.id)
    .eq("date_soiree", dateSoireeStr)
    .order("snapshot_at", { ascending: true });
  if (snapErr) throw snapErr;

  let meilleur: { count: number; at: string } | null = null;
  for (const s of (snapshots ?? []) as any[]) {
    if (s.count_actuel == null) continue;
    if (!meilleur || s.count_actuel > meilleur.count) meilleur = { count: s.count_actuel, at: s.snapshot_at };
  }
  if (!meilleur) return null;
  return { max: meilleur.count, heure: heureParisHhMm(meilleur.at) };
}

async function calculerStatistiques(
  supabase: SupabaseClient,
  etab: any,
  dateSoireeStr: string,
  debutISO: string,
  finISO: string,
): Promise<Statistiques> {
  if (etab.mode_jauge === "automatique") {
    const { data: jaugeEtat, error: jaugeErr } = await supabase
      .from("jauge_etat")
      .select("entrees_billetterie")
      .eq("etablissement_id", etab.id)
      .eq("date_soiree", dateSoireeStr)
      .eq("is_test", false)
      .maybeSingle();
    if (jaugeErr) throw jaugeErr;

    const { data: snapshots, error: snapErr } = await supabase
      .from("jauge_snapshots")
      .select("snapshot_at, entrees_billetterie")
      .eq("etablissement_id", etab.id)
      .eq("date_soiree", dateSoireeStr)
      .order("snapshot_at", { ascending: true });
    if (snapErr) throw snapErr;

    const points = ((snapshots ?? []) as any[]).map((s) => ({
      t: new Date(s.snapshot_at).getTime(),
      e: s.entrees_billetterie ?? 0,
    }));
    return {
      totalVisiteurs: jaugeEtat?.entrees_billetterie ?? 0,
      pic: calculerPic(points),
      noteSaut: detecterSaut(points),
    };
  }

  const { data: jaugeActions, error: actionsErr } = await supabase
    .from("jauge_actions")
    .select("action, delta")
    .eq("etablissement_id", etab.id)
    .eq("action", "entree")
    .gte("created_at", debutISO)
    .lt("created_at", finISO);
  if (actionsErr) throw actionsErr;

  const totalVisiteurs = (jaugeActions ?? []).reduce((sum: number, a: any) => sum + (a.delta ?? 0), 0);
  return { totalVisiteurs, pic: null, noteSaut: null };
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

function construireHtml(p: {
  etab: any;
  dateSoireeLabel: string;
  dateSoiree: string;
  evenements: any[];
  profMap: Record<string, string>;
  nbSSI: number;
  nbPersonnes: number;
  nbAgents: number;
  tendances: TendancesSoiree;
  reseauDesactive: boolean;
  stats: Statistiques;
  jaugeMax: { max: number; heure: string } | null;
}): string {
  const cartesEvenements = p.evenements.map((e: any) => {
    const heure = heureCourte(e.date_evenement);
    const agent = p.profMap[e.created_by] ?? e.created_by_email ?? "Inconnu";
    const typeColor =
      e.type === "ssi" ? "#ef4444" :
      e.type === "securite_personnes" ? "#3b82f6" :
      e.type === "radio" ? "#10b981" : "#f59e0b";
    const typeLabel =
      e.type === "ssi" ? "SSI" :
      e.type === "securite_personnes" ? "Sécurité" :
      e.type === "radio" ? "Radio" : (e.type ?? "—");
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
            ${e.espace_nom ?? "—"}${zoneTxt ? ` <span style="color:#9ca3af">${zoneTxt}</span>` : ""}
            <span style="color:#9ca3af;margin-left:6px;">— ${agent}</span>
          </div>
          <div style="font-size:13px;color:#6b7280;font-style:italic;line-height:1.4;">${commentaireTxt}</div>
        </div>`;
  }).join("");

  const picValeur = p.stats.pic
    ? `${p.stats.pic.plage}<div style="font-size:11px;font-weight:500;color:#64748b;margin-top:4px;">${p.stats.pic.entrees} ${p.stats.pic.entrees > 1 ? "entrées" : "entrée"}</div>`
    : "—";
  const logoHtml = p.etab.logo_url
    ? `<img src="${p.etab.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
    : "";
  const nomEntreprise = p.etab.nom ?? "Rapport de soirée";

  const visiteursTendance = htmlTendanceVisiteurs(p.tendances.etablissement, p.dateSoiree);
  const reseauLigne = htmlTendanceReseau(p.tendances.reseau, p.reseauDesactive);

  const statCell = (value: string | number, label: string, color: string, width: string, dessous = "") => `
          <td width="${width}" valign="top" style="width:${width};padding:0 2px;">
            <div style="background:#ffffff;border-radius:10px;padding:12px 4px;text-align:center;">
              <div class="stat-value" style="font-size:22px;font-weight:700;color:${color};line-height:1.1;">${value}</div>${dessous}
              <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.3;">${label}</div>
            </div>
          </td>`;

  const capacite = Number(p.etab.effectif_public) > 0 ? Number(p.etab.effectif_public) : null;
  const jaugeMax = p.jaugeMax;
  const jaugeValeur = jaugeMax
    ? `${jaugeMax.max}${capacite !== null ? ` / ${capacite}` : ""} <span style="font-size:13px;font-weight:600;">(${jaugeMax.heure})</span>`
    : "";
  const jaugeDessous = jaugeMax
    ? `<div style="font-size:11px;font-weight:500;color:#64748b;margin-top:4px;">selon les sorties comptées ce soir-là</div>`
    : "";
  const jaugeHtml = jaugeMax ? statCell(jaugeValeur, "Jauge maximale", "#f59e0b", "33%", jaugeDessous) : "";
  const capaciteLigne = capacite !== null
    ? `<p style="font-size:11px;color:#64748b;margin:8px 0 0;text-align:right;">Capacité autorisée : ${capacite}</p>`
    : "";
  const jaugeDepassement = jaugeMax && capacite !== null && jaugeMax.max > capacite
    ? `<p style="font-size:12px;color:#b91c1c;background:#fee2e2;border-radius:8px;padding:8px 10px;margin:10px 0 0;">Jauge maximale supérieure à la capacité autorisée d'après les données enregistrées</p>`
    : "";
  const largeurFrequentation = jaugeMax ? "33%" : "50%";

  return `<!DOCTYPE html>
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
  <title>Rapport de soirée — ${p.dateSoireeLabel}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto">

    <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 24px 22px;">
      ${logoHtml}
      <p style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px">Main Courante — Rapport de soirée</p>
      <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0;line-height:1.2">${nomEntreprise}</h1>
    </div>

    <div style="background:#1e293b;padding:14px 24px;">
      <p style="color:#e2e8f0;font-size:16px;font-weight:700;margin:0 0 4px">Soirée du ${p.dateSoireeLabel}</p>
    </div>

    <div style="background:#f1f5f9;padding:16px 12px 14px;border-bottom:1px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;">Fréquentation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${statCell(p.stats.totalVisiteurs, "Visiteurs", "#22c55e", largeurFrequentation, visiteursTendance)}
          ${statCell(picValeur, "Pic d'arrivées", "#60a5fa", largeurFrequentation)}
          ${jaugeHtml}
        </tr>
      </table>
      ${capaciteLigne}
      ${jaugeDepassement}
      ${reseauLigne}
      ${p.stats.noteSaut ? `<p style="font-size:12px;color:#92400e;background:#fef3c7;border-radius:8px;padding:8px 10px;margin:10px 0 0;">Relevé billetterie interrompu puis rétabli vers ${p.stats.noteSaut}, le rythme d'arrivées avant cette heure peut être sous-estimé.</p>` : ""}
    </div>

    <div style="background:#f1f5f9;padding:0 12px 16px;border-bottom:1px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;">Activité</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${statCell(p.evenements.length, "Événements", "#1e293b", "25%")}
          ${statCell(p.nbSSI, "SSI", "#ef4444", "25%")}
          ${statCell(p.nbPersonnes, "Sécu", "#3b82f6", "25%")}
          ${statCell(p.nbAgents, "Agents", "#22c55e", "25%")}
        </tr>
      </table>
    </div>

    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:18px 16px 14px;">
      <h2 style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 12px">Journal des événements</h2>
      ${p.evenements.length === 0 ? `<p style="font-size:13px;color:#64748b;margin:0;">Aucun événement</p>` : cartesEvenements}
    </div>

    <div style="padding:16px 0;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0">Généré automatiquement par Main Courante</p>
      <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" })}</p>
      <p style="font-size:11px;color:#94a3b8;margin:8px 0 0"><a href="${LIEN_DESINSCRIPTION}" style="color:#94a3b8;text-decoration:underline;">Se désinscrire du rapport de soirée</a></p>
    </div>

  </div>
</body>
</html>`;
}

type ResultatResend = { id: string | null; status: number | null; erreur: string | null };

async function appelerResend(payload: Record<string, unknown>): Promise<ResultatResend> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok) return { id: json.id ?? null, status: res.status, erreur: null };
    return { id: null, status: res.status, erreur: json.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { id: null, status: null, erreur: err instanceof Error ? err.message : "erreur réseau" };
  }
}

async function envoyerAvecReprise(payload: Record<string, unknown>): Promise<ResultatResend> {
  const premier = await appelerResend(payload);
  const reessayer = premier.status === 429 || (premier.status !== null && premier.status >= 500);
  if (!reessayer) return premier;
  await pause(PAUSE_ENTRE_ENVOIS_MS);
  return appelerResend(payload);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const force = body?.force === true;
    const testRecipients: string[] | null = body?.test_recipients !== undefined ? body.test_recipients : null;
    const nowOverride: string | null = body?.now_override !== undefined ? body.now_override : null;
    const tendancesSimulees = body?.tendances_simulees ?? null;

    if (nowOverride !== null && !dryRun) {
      return jsonResponse({ error: "now_override réservé à dry_run" }, 400);
    }
    const maintenant = nowOverride !== null ? new Date(nowOverride) : new Date();
    if (Number.isNaN(maintenant.getTime())) return jsonResponse({ error: "now_override invalide" }, 400);
    if (testRecipients !== null) {
      const valides = Array.isArray(testRecipients) && testRecipients.length > 0 &&
        testRecipients.every((a) => DESTINATAIRES_TEST_AUTORISES.includes(a));
      if (!valides) return jsonResponse({ error: "Destinataires de test non autorisés" }, 400);
    }
    if (tendancesSimulees !== null) {
      if (testRecipients === null) return jsonResponse({ error: "tendances_simulees réservé aux envois de test" }, 400);
      if (!valideTendancesSimulees(tendancesSimulees)) return jsonResponse({ error: "tendances_simulees invalide" }, 400);
    }

    let dateSoireeStr = ajouterJours(dateParis(maintenant), -1);
    if (body?.date_soiree !== undefined) {
      if (typeof body.date_soiree !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date_soiree)) {
        return jsonResponse({ error: "date_soiree invalide" }, 400);
      }
      dateSoireeStr = body.date_soiree;
    }

    const debutISO = parisAtISO(dateSoireeStr, "08:00");
    const finISO = parisAtISO(ajouterJours(dateSoireeStr, 1), "08:00");
    const statsDebutISO = parisAtISO(dateSoireeStr, "06:00");
    const statsFinISO = parisAtISO(ajouterJours(dateSoireeStr, 1), "06:00");

    const gardeHoraire = testRecipients === null && !force && (!dryRun || nowOverride !== null);
    if (gardeHoraire && heureParis(maintenant) < HEURE_ENVOI_MIN) {
      return jsonResponse({
        success: true,
        skipped: "trop_tot",
        message: "Trop tôt : le rapport part à partir de 08:00 heure de Paris.",
      });
    }

    const { data: tousEtablissements, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, logo_url, effectif_public, mode_jauge, statut, barometre_participe");
    if (etabErr) throw etabErr;

    const filtreIds: string[] | null = Array.isArray(body?.etablissement_ids) ? body.etablissement_ids : null;
    const etablissements = (tousEtablissements ?? []).filter((e: any) =>
      STATUTS_ELIGIBLES.includes(e.statut) && (filtreIds === null || filtreIds.includes(e.id))
    );

    if (etablissements.length === 0) {
      return jsonResponse({ message: "Aucun établissement actif", date_soiree: dateSoireeStr });
    }

    const results: Record<string, unknown>[] = [];

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

      let rapportExistant: { id: string } | null = null;
      let decisionRapport: DecisionRapport = "absent";
      if (testRecipients === null) {
        const { data: existant, error: existErr } = await supabase
          .from("rapports_soiree")
          .select("id, created_at")
          .eq("etablissement_id", etab.id)
          .eq("date_soiree", dateSoireeStr)
          .maybeSingle();
        if (existErr) {
          results.push({ etab_id: etab.id, nom: etab.nom, skipped: `rapport_check_error: ${existErr.message}` });
          continue;
        }
        if (existant) {
          const { data: journal, error: journalErr } = await supabase
            .from("rapport_envois")
            .select("statut")
            .eq("etablissement_id", etab.id)
            .eq("date_soiree", dateSoireeStr)
            .eq("test", false);
          if (journalErr) {
            results.push({ etab_id: etab.id, nom: etab.nom, skipped: `journal_error: ${journalErr.message}` });
            continue;
          }
          decisionRapport = decisionRapportExistant(existant, (journal ?? []).map((j) => j.statut));
          rapportExistant = { id: existant.id };
          if (decisionRapport === "ignore" && !force && !dryRun) {
            results.push({ etab_id: etab.id, nom: etab.nom, skipped: "rapport_deja_existant" });
            continue;
          }
        }
      }
      const reprise = decisionRapport === "reprise" && !force && !dryRun;

      const { data: evenementsBruts, error: evErr } = await supabase
        .from("evenements")
        .select(COLONNES_EVENEMENTS)
        .eq("etablissement_id", etab.id)
        .gte("date_evenement", debutISO)
        .lt("date_evenement", finISO)
        .order("date_evenement", { ascending: true });
      if (evErr) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: `evenements_error: ${evErr.message}` });
        continue;
      }
      const evenements = evenementsBruts ?? [];

      const stats = await calculerStatistiques(supabase, etab, dateSoireeStr, statsDebutISO, statsFinISO);
      const jaugeMax = await calculerJaugeMaximale(supabase, etab, dateSoireeStr);
      const regle = evaluerRegle(evenements.length, stats.totalVisiteurs);
      if (!regle.envoyer && !dryRun) {
        results.push({
          etab_id: etab.id,
          nom: etab.nom,
          skipped: "aucune_activite",
          motif: regle.motif,
          nb_evenements: evenements.length,
          visiteurs: stats.totalVisiteurs,
        });
        continue;
      }

      const { tendances, erreur: tendancesErreur } = await calculerTendances(supabase, etab.id, dateSoireeStr, tendancesSimulees);

      const destinataires = testRecipients !== null
        ? testRecipients
        : await resoudreDestinataires(supabase, etab, rule);
      if (dryRun) {
        results.push({
          etab_id: etab.id,
          nom: etab.nom,
          decision: regle.envoyer ? "envoyer" : "ne_pas_envoyer",
          motif: regle.motif,
          nb_evenements: evenements.length,
          evenements: evenements.map((e: any) => ({
            heure: heureCourte(e.date_evenement),
            type: e.type,
            espace: e.espace_nom ?? null,
            zone: e.zone_nom ?? null,
          })),
          visiteurs: stats.totalVisiteurs,
          tendances,
          tendances_erreur: tendancesErreur,
          pic: stats.pic,
          note_saut: stats.noteSaut,
          jauge_maximale: jaugeMax,
          rapport: decisionRapport,
          nb_destinataires: destinataires.length,
          destinataires: destinataires.map(maskEmail),
        });
        continue;
      }

      if (destinataires.length === 0) {
        results.push({ etab_id: etab.id, nom: etab.nom, skipped: "aucun_destinataire" });
        continue;
      }

      const agentIds = [...new Set(evenements.map((e: any) => e.created_by).filter(Boolean))];
      const { data: profiles, error: profErr } = agentIds.length > 0
        ? await supabase.from("user_profiles").select("id, first_name, last_name").in("id", agentIds)
        : { data: [], error: null };
      if (profErr) throw profErr;

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

      const dateSoireeLabel = new Date(debutISO).toLocaleDateString("fr-FR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris",
      });
      const nomEntreprise = etab.nom ?? "Rapport de soirée";
      const contenuHtml = construireHtml({
        etab,
        dateSoireeLabel,
        dateSoiree: dateSoireeStr,
        tendances,
        reseauDesactive: etab.barometre_participe === false,
        evenements,
        profMap,
        nbSSI: evenements.filter((e: any) => e.type === "ssi").length,
        nbPersonnes: evenements.filter((e: any) => e.type !== "ssi").length,
        nbAgents: agentIds.length,
        stats,
        jaugeMax,
      });

      let rapportId: string | null = null;
      if (reprise && rapportExistant) {
        rapportId = rapportExistant.id;
      } else if (testRecipients === null) {
        const { data: rapport, error: upsertErr } = await supabase
          .from("rapports_soiree")
          .upsert({
            date_soiree: dateSoireeStr,
            etablissement_id: etab.id,
            debut_soiree: debutISO,
            fin_soiree: finISO,
            nb_evenements: evenements.length,
            nb_agents: agentIds.length,
            contenu_html: contenuHtml,
          }, { onConflict: "etablissement_id,date_soiree" })
          .select("id")
          .single();
        if (upsertErr) {
          results.push({ etab_id: etab.id, nom: etab.nom, skipped: `upsert_error: ${upsertErr.message}` });
          continue;
        }
        rapportId = rapport.id;
      }

      const sujet = `[Main Courante] Rapport de soirée — ${nomEntreprise} — ${dateSoireeLabel}`;
      const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";
      const envois: Record<string, unknown>[] = [];

      for (let i = 0; i < destinataires.length; i++) {
        const to = destinataires[i];
        if (i > 0) await pause(PAUSE_ENTRE_ENVOIS_MS);
        const resultat = await envoyerAvecReprise({
          from: FROM_EMAIL,
          to: [to],
          reply_to: REPLY_TO,
          subject: sujet,
          html: contenuHtml,
          headers: { "List-Unsubscribe": `<${LIEN_DESINSCRIPTION}>` },
        });
        const statut = resultat.erreur ? "erreur" : "envoye";

        const { error: journalErr } = await supabase.from("rapport_envois").insert({
          rapport_id: rapportId,
          etablissement_id: etab.id,
          date_soiree: dateSoireeStr,
          destinataire: to,
          resend_id: resultat.id,
          statut,
          http_status: resultat.status,
          erreur: resultat.erreur,
          test: testRecipients !== null,
        });

        envois.push({
          destinataire: maskEmail(to),
          resend_id: resultat.id,
          statut,
          http_status: resultat.status,
          erreur: resultat.erreur,
          journal_error: journalErr?.message ?? null,
        });
      }

      results.push({
        etab_id: etab.id,
        nom: etab.nom,
        decision: "envoyer",
        motif: regle.motif,
        nb_evenements: evenements.length,
        nb_agents: agentIds.length,
        envois_reussis: envois.filter((e) => e.statut === "envoye").length,
        envois_en_erreur: envois.filter((e) => e.statut === "erreur").length,
        envois,
        tendances_erreur: tendancesErreur,
      });
    }

    return jsonResponse({
      success: true,
      date_soiree: dateSoireeStr,
      heure_utilisee: maintenant.toISOString(),
      fenetre: { debut: debutISO, fin: finISO },
      dry_run: dryRun,
      test_recipients: testRecipients !== null,
      force,
      results,
    });
  } catch (err: unknown) {
    console.error("[rapport-soiree] erreur:", err);
    return jsonResponse({ error: "An error occurred processing your request." }, 500);
  }
});
