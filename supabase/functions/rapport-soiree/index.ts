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
  countMax: number;
  heureMaxEnSalle: string;
  heurePointe: string;
};

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

async function evaluerRegle(supabase: SupabaseClient, etab: any, nbEvenements: number, dateSoireeStr: string) {
  const { data: jaugeEtat, error: jaugeErr } = await supabase
    .from("jauge_etat")
    .select("entrees_billetterie, count_actuel")
    .eq("etablissement_id", etab.id)
    .eq("date_soiree", dateSoireeStr)
    .eq("is_test", false)
    .maybeSingle();
  if (jaugeErr) throw jaugeErr;

  let snapshotsMax: number | null = null;
  if (jaugeEtat) {
    const { data: snapshots, error: snapErr } = await supabase
      .from("jauge_snapshots")
      .select("count_actuel")
      .eq("etablissement_id", etab.id)
      .eq("date_soiree", dateSoireeStr);
    if (snapErr) throw snapErr;
    if (snapshots && snapshots.length > 0) {
      snapshotsMax = Math.max(...snapshots.map((s: any) => s.count_actuel ?? 0));
    }
  }

  const maxEnSalle = snapshotsMax ?? jaugeEtat?.count_actuel ?? 0;
  const sourceMax = snapshotsMax !== null ? "snapshots" : jaugeEtat ? "repli_jauge_etat" : "aucune_donnee";
  const envoyer = nbEvenements >= 1 || maxEnSalle > 1;
  const motif = nbEvenements >= 1
    ? "au moins 1 événement"
    : maxEnSalle > 1 ? "max en salle > 1" : "aucune activité";

  return { maxEnSalle, sourceMax, envoyer, motif };
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

async function calculerStatistiques(
  supabase: SupabaseClient,
  etab: any,
  dateSoireeStr: string,
  debutISO: string,
  finISO: string,
): Promise<Statistiques> {
  let totalVisiteurs = 0;
  let countMax = 0;
  let heureMaxEnSalle = "—";
  let heurePointe = "—";

  if (etab.mode_jauge === "automatique") {
    const { data: jaugeEtat, error: jaugeErr } = await supabase
      .from("jauge_etat")
      .select("entrees_billetterie")
      .eq("etablissement_id", etab.id)
      .eq("date_soiree", dateSoireeStr)
      .eq("is_test", false)
      .maybeSingle();
    if (jaugeErr) throw jaugeErr;
    totalVisiteurs = jaugeEtat?.entrees_billetterie ?? 0;

    const { data: snapshots, error: snapErr } = await supabase
      .from("jauge_snapshots")
      .select("snapshot_at, count_actuel, entrees_billetterie")
      .eq("etablissement_id", etab.id)
      .eq("date_soiree", dateSoireeStr)
      .order("snapshot_at", { ascending: true });
    if (snapErr) throw snapErr;

    if (snapshots && snapshots.length > 0) {
      for (const s of snapshots as any[]) {
        if (s.count_actuel > countMax) {
          countMax = s.count_actuel;
          heureMaxEnSalle = heureCourte(s.snapshot_at).replace(":", "h");
        }
      }

      const parisHourFmt = new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit", timeZone: "Europe/Paris", hour12: false,
      });
      const parisHourOf = (d: Date): string => {
        const h = parisHourFmt.formatToParts(d).find((p) => p.type === "hour")?.value ?? "00";
        return String(parseInt(h, 10)).padStart(2, "0");
      };
      const hourlyEntrees: Record<string, number> = {};
      let prevEntrees = snapshots[0].entrees_billetterie;
      let prevHour = parisHourOf(new Date(snapshots[0].snapshot_at));
      for (let i = 1; i < snapshots.length; i++) {
        const s = snapshots[i] as any;
        const delta = (s.entrees_billetterie ?? 0) - prevEntrees;
        if (delta > 0) {
          hourlyEntrees[prevHour] = (hourlyEntrees[prevHour] ?? 0) + delta;
        }
        prevHour = parisHourOf(new Date(s.snapshot_at));
        prevEntrees = s.entrees_billetterie;
      }

      let maxEntrees = 0;
      let maxHour = "—";
      for (const [hour, entrees] of Object.entries(hourlyEntrees)) {
        if (entrees > maxEntrees) {
          maxEntrees = entrees;
          maxHour = hour + "h";
        }
      }
      if (maxEntrees > 0) heurePointe = maxHour;
    }
  } else {
    const { data: jaugeActions, error: actionsErr } = await supabase
      .from("jauge_actions")
      .select("action, delta, created_at")
      .eq("etablissement_id", etab.id)
      .gte("created_at", debutISO)
      .lt("created_at", finISO)
      .order("created_at", { ascending: true });
    if (actionsErr) throw actionsErr;

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
        heurePointe = heureCourte(heurePointeDate.toISOString()).replace(":", "h");
        heureMaxEnSalle = heurePointe;
      }
    }
  }

  return { totalVisiteurs, countMax, heureMaxEnSalle, heurePointe };
}

function construireHtml(p: {
  etab: any;
  dateSoireeLabel: string;
  heureDebut: string;
  heureFin: string;
  evenements: any[];
  profMap: Record<string, string>;
  nbSSI: number;
  nbPersonnes: number;
  nbAgents: number;
  stats: Statistiques;
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

  const logoHtml = p.etab.logo_url
    ? `<img src="${p.etab.logo_url}" style="height:44px;width:auto;border-radius:8px;margin-bottom:10px;display:block" alt="Logo">`
    : "";
  const nomEntreprise = p.etab.nom ?? "Rapport de soirée";

  const statCell = (value: string | number, label: string, color: string, width: string) => `
          <td width="${width}" valign="top" style="width:${width};padding:0 2px;">
            <div style="background:#ffffff;border-radius:10px;padding:12px 4px;text-align:center;">
              <div class="stat-value" style="font-size:22px;font-weight:700;color:${color};line-height:1.1;">${value}</div>
              <div class="stat-label" style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.3;">${label}</div>
            </div>
          </td>`;

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
      <p style="color:#475569;font-size:12px;margin:0">${p.heureDebut} → ${p.heureFin} (heure de Paris)</p>
    </div>

    <div style="background:#f1f5f9;padding:16px 12px 14px;border-bottom:1px solid #e2e8f0;">
      <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em;">Fréquentation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          ${statCell(p.stats.totalVisiteurs, "Visiteurs", "#22c55e", "33%")}
          ${statCell(p.stats.countMax, `Max en salle${p.stats.heureMaxEnSalle !== "—" ? ` (${p.stats.heureMaxEnSalle})` : ""}`, "#f59e0b", "34%")}
          ${statCell(p.stats.heurePointe, "Heure de pointe", "#60a5fa", "33%")}
        </tr>
      </table>
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
      ${cartesEvenements}
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
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isCronCall) {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
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

    if ((force || testRecipients !== null) && !isCronCall) {
      return jsonResponse({ error: "Réservé au service" }, 403);
    }
    if (testRecipients !== null) {
      const valides = Array.isArray(testRecipients) && testRecipients.length > 0 &&
        testRecipients.every((a) => DESTINATAIRES_TEST_AUTORISES.includes(a));
      if (!valides) return jsonResponse({ error: "Destinataires de test non autorisés" }, 400);
    }

    const maintenant = new Date();
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

    const envoiReel = !dryRun && testRecipients === null && !force;
    if (envoiReel && heureParis(maintenant) < HEURE_ENVOI_MIN) {
      return jsonResponse({
        success: true,
        skipped: "trop_tot",
        message: "Trop tôt : le rapport part à partir de 08:00 heure de Paris.",
      });
    }

    const { data: tousEtablissements, error: etabErr } = await supabase
      .from("etablissements")
      .select("id, nom, logo_url, effectif_public, mode_jauge, statut");
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

      if (envoiReel && !force) {
        const { data: rapportExistant, error: existErr } = await supabase
          .from("rapports_soiree")
          .select("id")
          .eq("etablissement_id", etab.id)
          .eq("date_soiree", dateSoireeStr)
          .maybeSingle();
        if (existErr) {
          results.push({ etab_id: etab.id, nom: etab.nom, skipped: `rapport_check_error: ${existErr.message}` });
          continue;
        }
        if (rapportExistant) {
          results.push({ etab_id: etab.id, nom: etab.nom, skipped: "rapport_deja_existant" });
          continue;
        }
      }

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

      const regle = await evaluerRegle(supabase, etab, evenements.length, dateSoireeStr);
      if (!regle.envoyer && !dryRun) {
        results.push({
          etab_id: etab.id,
          nom: etab.nom,
          skipped: "aucune_activite",
          motif: regle.motif,
          nb_evenements: evenements.length,
          max_en_salle: regle.maxEnSalle,
        });
        continue;
      }

      const destinataires = testRecipients !== null
        ? testRecipients
        : await resoudreDestinataires(supabase, etab, rule);
      const stats = await calculerStatistiques(supabase, etab, dateSoireeStr, statsDebutISO, statsFinISO);

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
          max_en_salle: regle.maxEnSalle,
          source_max: regle.sourceMax,
          visiteurs: stats.totalVisiteurs,
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
        heureDebut: heureCourte(debutISO),
        heureFin: heureCourte(finISO),
        evenements,
        profMap,
        nbSSI: evenements.filter((e: any) => e.type === "ssi").length,
        nbPersonnes: evenements.filter((e: any) => e.type !== "ssi").length,
        nbAgents: agentIds.length,
        stats,
      });

      let rapportId: string | null = null;
      if (testRecipients === null) {
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
        max_en_salle: regle.maxEnSalle,
        envois_reussis: envois.filter((e) => e.statut === "envoye").length,
        envois_en_erreur: envois.filter((e) => e.statut === "erreur").length,
        envois,
      });
    }

    return jsonResponse({
      success: true,
      date_soiree: dateSoireeStr,
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
