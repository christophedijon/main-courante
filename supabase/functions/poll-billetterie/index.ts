import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().slice(0, 10);
  const details: Array<{ entreprise_id: string; nom: string; status: string; entrees?: number; diff?: number; error?: string }> = [];
  let succes = 0;
  let erreurs = 0;

  // Récupérer tous les établissements en mode automatique avec une URL billetterie
  const { data: etablissements, error: fetchErr } = await supabase
    .from("entreprise")
    .select("id, nom, url_billetterie, frequence_billetterie")
    .eq("mode_jauge", "automatique")
    .not("url_billetterie", "is", null)
    .neq("url_billetterie", "");

  if (fetchErr) {
    console.error("[poll-billetterie] Erreur lecture entreprises:", fetchErr.message);
    return json({ error: "Impossible de lire les entreprises", details: fetchErr.message }, 500);
  }

  if (!etablissements || etablissements.length === 0) {
    return json({ message: "Aucun établissement en mode automatique", total_etablissements: 0, succes: 0, erreurs: 0, details: [] });
  }

  for (const etab of etablissements) {
    try {
      // 1. Fetch Zapsis
      const zapRes = await fetch(etab.url_billetterie, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!zapRes.ok) {
        throw new Error(`Zapsis HTTP ${zapRes.status}`);
      }

      const zapData = await zapRes.json();
      if (zapData.resultat !== "success" || !zapData.data) {
        throw new Error(`Zapsis résultat invalide: ${JSON.stringify(zapData)}`);
      }

      const entrees = parseInt(zapData.data, 10);
      if (isNaN(entrees) || entrees < 0) {
        throw new Error(`Zapsis valeur non parseable: "${zapData.data}"`);
      }

      // 2. Lire l'état jauge actuel pour aujourd'hui
      const { data: etat } = await supabase
        .from("jauge_etat")
        .select("entrees_max_zapsis")
        .eq("entreprise_id", etab.id)
        .eq("date_soiree", today)
        .eq("is_test", false)
        .maybeSingle();

      const lastZapsisCount = etat?.entrees_max_zapsis ?? null;

      if (lastZapsisCount === null || lastZapsisCount === 0 && entrees > 0 && etat === null) {
        // Premier appel de la journée : initialise avec le total Zapsis
        const { error: rpcErr } = await supabase.rpc("set_entrees_manuelles", {
          p_entreprise_id: etab.id,
          p_entrees: entrees,
          p_user_id: null,
          p_is_test: false,
        });
        if (rpcErr) throw new Error(`set_entrees_manuelles: ${rpcErr.message}`);

        details.push({ entreprise_id: etab.id, nom: etab.nom, status: "init", entrees });
      } else {
        // Incrément delta depuis le dernier poll
        const diff = entrees - (lastZapsisCount ?? 0);
        if (diff > 0) {
          const { error: rpcErr } = await supabase.rpc("increment_jauge", {
            p_entreprise_id: etab.id,
            p_delta: diff,
            p_source: "app",
            p_user_id: null,
            p_is_test: false,
          });
          if (rpcErr) throw new Error(`increment_jauge: ${rpcErr.message}`);
        }
        details.push({ entreprise_id: etab.id, nom: etab.nom, status: "ok", entrees, diff: Math.max(0, diff) });
      }

      // 3. Mettre à jour entrees_max_zapsis si valeur plus haute
      if (entrees > (lastZapsisCount ?? 0)) {
        await supabase
          .from("jauge_etat")
          .update({ entrees_max_zapsis: entrees })
          .eq("entreprise_id", etab.id)
          .eq("date_soiree", today)
          .eq("is_test", false);
      }

      succes++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll-billetterie] Erreur pour "${etab.nom}":`, msg);
      details.push({ entreprise_id: etab.id, nom: etab.nom, status: "erreur", error: msg });
      erreurs++;
    }
  }

  console.log(`[poll-billetterie] Terminé — ${succes} OK, ${erreurs} erreurs`);

  return json({
    total_etablissements: etablissements.length,
    succes,
    erreurs,
    details,
  });
});
