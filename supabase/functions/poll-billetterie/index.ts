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

  const details: Array<{ etablissement_id: string; nom: string; status: string; entrees?: number; error?: string }> = [];
  let succes = 0;
  let erreurs = 0;

  // Récupérer tous les établissements en mode automatique avec une URL billetterie
  const { data: etablissements, error: fetchErr } = await supabase
    .from("etablissements")
    .select("id, nom, url_billetterie, frequence_billetterie")
    .eq("mode_jauge", "automatique")
    .in("statut", ["essai", "actif"])
    .not("url_billetterie", "is", null)
    .neq("url_billetterie", "");

  if (fetchErr) {
    console.error("[poll-billetterie] Erreur lecture établissements:", fetchErr.message);
    return json({ error: "Impossible de lire les établissements", details: fetchErr.message }, 500);
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

      // 2. Sync jauge — calcul absolu, toujours convergent vers la vérité Zapsis.
      //    count_actuel = max(0, entrees_zapsis - sorties_flic_aujourd_hui)
      //    Immune aux saisies manuelles qui pourraient écraser la valeur.
      const { error: rpcErr } = await supabase.rpc("sync_jauge_zapsis", {
        p_etablissement_id: etab.id,
        p_entrees: entrees,
        p_is_test: false,
      });
      if (rpcErr) throw new Error(`sync_jauge_zapsis: ${rpcErr.message}`);

      details.push({ etablissement_id: etab.id, nom: etab.nom, status: "ok", entrees });
      succes++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll-billetterie] Erreur pour "${etab.nom}":`, msg);
      details.push({ etablissement_id: etab.id, nom: etab.nom, status: "erreur", error: msg });
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
