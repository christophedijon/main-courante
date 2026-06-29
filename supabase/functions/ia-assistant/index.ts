import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  // 1. Require authenticated session
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized: missing Authorization header" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "Unauthorized: invalid token" }, 401);
  }

  // 2. OpenAI key from Supabase Secrets — never from DB
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.error("OPENAI_API_KEY not configured in Supabase Secrets");
    return json({ error: "Assistant IA non configuré." }, 500);
  }

  // 3. Validate request body
  let message: string;
  let mode: string | undefined;
  try {
    const body = await req.json();
    message = body.message;
    mode = body.mode;
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!message || typeof message !== "string" || message.trim() === "") {
    return json({ error: "Message manquant." }, 400);
  }

  // 4. Rate-limiting: max 50 calls/day per user
  const today = new Date().toISOString().split("T")[0];
  const { count: callsToday } = await userClient
    .from("ia_historique")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .gte("created_at", `${today}T00:00:00Z`);

  if ((callsToday ?? 0) >= 50) {
    return json({ error: "Limite journalière atteinte (50 requêtes/jour)." }, 429);
  }

  // Service-role client for privileged reads (ia_settings, entreprise, toolbox_documents)
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 5. Load IA settings (prompts + models only — no API key)
  const { data: iaSettings } = await serviceClient
    .from("ia_settings")
    .select("prompt, prompt_erp, prompt_bruit, prompt_router, gpt_model, gpt_model_erp, gpt_model_bruit, gpt_model_router")
    .limit(1)
    .maybeSingle();

  if (!iaSettings) {
    return json({ error: "Assistant IA non configuré." }, 400);
  }

  // 6. Load establishment context and SSI documents
  const { data: entreprise } = await serviceClient
    .from("etablissements")
    .select("nom, adresse, activite_principale, activites_complementaires, activites_reelles, licence_boissons, categorie_erp, effectif_public, effectif_personnel, questionnaire_reponses, horaires_ouverture, siret, code_ape")
    .in("statut", ["essai", "actif"])
    .limit(1)
    .maybeSingle();

  const { data: ssiDocs } = await serviceClient
    .from("toolbox_documents")
    .select("titre, contenu, categorie")
    .in("categorie", ["SSI", "PROCEDURE"])
    .eq("actif", true)
    .order("ordre", { ascending: true });

  let entrepriseContext = "";
  if (entreprise) {
    const activitesReelles = Array.isArray(entreprise.activites_reelles)
      ? entreprise.activites_reelles.join(", ")
      : "";
    const activitesCompl = Array.isArray(entreprise.activites_complementaires)
      ? entreprise.activites_complementaires.join(", ")
      : "";
    const licenceLabel: Record<string, string> = {
      "I": "Licence I — Sans alcool",
      "II": "Licence II — Bières/vins doux",
      "III": "Licence III — Vins/bières",
      "IV": "Licence IV — Tous alcools",
      "restaurant": "Licence restaurant",
      "petite_restaurant": "Petite licence restaurant",
    };
    const qReponses = entreprise.questionnaire_reponses
      ? Object.entries(entreprise.questionnaire_reponses).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";
    const horaires = entreprise.horaires_ouverture
      ? Object.entries(entreprise.horaires_ouverture as Record<string, { ouvert: boolean; ouverture: string; fermeture: string }>)
          .filter(([, v]) => v.ouvert)
          .map(([jour, v]) => `${jour}: ${v.ouverture}-${v.fermeture}`)
          .join(", ")
      : "Non renseignés";

    entrepriseContext = `

═══════════════════════════════════════
CONTEXTE OBLIGATOIRE DE L'ÉTABLISSEMENT
Tu DOIS utiliser ces informations dans ta réponse.
Ne donne JAMAIS de réponse générique.
═══════════════════════════════════════
Nom : ${entreprise.nom ?? "Non renseigné"}
Adresse : ${entreprise.adresse ?? "Non renseignée"}
SIRET : ${entreprise.siret ?? "Non renseigné"}
Code APE : ${entreprise.code_ape ?? "Non renseigné"}
Type ERP principal : Type ${entreprise.activite_principale ?? "P"}
Activités complémentaires : ${activitesCompl || "Aucune"}
Activités exercées : ${activitesReelles || "Non renseignées"}
Licence : ${licenceLabel[entreprise.licence_boissons ?? ""] ?? entreprise.licence_boissons ?? "Non renseignée"}
Catégorie ERP : ${entreprise.categorie_erp ?? "Non renseignée"}
Effectif public maximum : ${entreprise.effectif_public ?? "Non renseigné"} personnes
Effectif personnel : ${entreprise.effectif_personnel ?? "Non renseigné"} personnes
Horaires d'ouverture : ${horaires}
Profil détaillé : ${qReponses || "Non renseigné"}
═══════════════════════════════════════
INSTRUCTION ABSOLUE :
Adapte TOUJOURS ta réponse à cet établissement.
═══════════════════════════════════════`;
  }

  let documentContext = "";
  if (ssiDocs && ssiDocs.length > 0) {
    documentContext = `

═══════════════════════════════════════
DOCUMENTS SSI ET PROCÉDURES
═══════════════════════════════════════
${ssiDocs.map((doc: { categorie: string; titre: string; contenu: string }) =>
  `--- ${doc.categorie} : ${doc.titre} ---\n${doc.contenu}`
).join("\n\n")}
═══════════════════════════════════════`;
  }

  // 7. Route to the appropriate expert(s)
  let experts: string[] = ["terrain"];
  if (iaSettings.prompt_router && iaSettings.prompt_router.trim() !== "") {
    try {
      const routerRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: iaSettings.gpt_model_router || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: iaSettings.prompt_router },
            { role: "user", content: message },
          ],
          max_tokens: 50,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const routerData = await routerRes.json();
      const routerText = routerData.choices?.[0]?.message?.content?.trim() ?? '["terrain"]';
      const parsed = JSON.parse(routerText);
      if (Array.isArray(parsed)) experts = parsed;
    } catch {
      experts = ["terrain"];
    }
  }

  // Manual mode override
  if (mode === "erp") experts = ["erp"];
  if (mode === "bruit") experts = ["bruit"];
  if (mode === "terrain") experts = ["terrain"];

  // 8. Assemble prompt from selected expert(s)
  const promptParts: string[] = [];
  if (experts.includes("terrain") && iaSettings.prompt) {
    promptParts.push(`=== EXPERT SÉCURITÉ TERRAIN ===\n${iaSettings.prompt}`);
  }
  if (experts.includes("erp") && iaSettings.prompt_erp) {
    promptParts.push(`=== EXPERT RÉGLEMENTATION ERP ===\n${iaSettings.prompt_erp}`);
  }
  if (experts.includes("bruit") && iaSettings.prompt_bruit) {
    promptParts.push(`=== EXPERT BRUIT ET ACOUSTIQUE ===\n${iaSettings.prompt_bruit}`);
  }
  if (promptParts.length === 0 && iaSettings.prompt) {
    promptParts.push(iaSettings.prompt);
  }

  let combinedPrompt = promptParts.join("\n\n");
  if (promptParts.length > 1) {
    combinedPrompt += `\n\n=== INSTRUCTION DE SYNTHÈSE ===\nCombine les expertises ci-dessus. Structure en 4 blocs clairs.`;
  }
  combinedPrompt += entrepriseContext + documentContext;

  // 9. Call OpenAI
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: experts.includes("erp")
          ? (iaSettings.gpt_model_erp || iaSettings.gpt_model || "gpt-4o")
          : experts.includes("bruit")
          ? (iaSettings.gpt_model_bruit || iaSettings.gpt_model || "gpt-4o")
          : (iaSettings.gpt_model || "gpt-4o"),
        messages: [
          { role: "system", content: combinedPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) {
      return json({ error: openaiData.error?.message || "Erreur OpenAI" }, 500);
    }

    const content = openaiData.choices?.[0]?.message?.content || "";

    // 10. Log to ia_historique (fire-and-forget, don't block response)
    serviceClient.from("ia_historique").insert({
      agent_id: user.id,
      agent_nom: user.email ?? "",
      question: message,
      reponse_complete: content,
      sections: [],
    }).then(({ error }) => {
      if (error) console.error("ia_historique insert error:", error.message);
    });

    return json({ response: content, experts });
  } catch (err: unknown) {
    console.error("[ia-assistant] unhandled error:", err);
    return json({ error: "An error occurred processing your request." }, 500);
  }
});
