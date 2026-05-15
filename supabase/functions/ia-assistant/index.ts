import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const { message, mode } = await req.json();

    if (!message || typeof message !== "string" || message.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Message manquant." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: iaSettings } = await supabase
      .from("ia_settings")
      .select("prompt, prompt_erp, prompt_bruit, prompt_router, openai_api_key, gpt_model, gpt_model_erp, gpt_model_bruit, gpt_model_router")
      .limit(1)
      .maybeSingle();

    if (!iaSettings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: "Assistant IA non configuré." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: entreprise } = await supabase
      .from("entreprise")
      .select("nom, adresse, activite_principale, activites_complementaires, activites_reelles, licence_boissons, categorie_erp, effectif_public, effectif_personnel, questionnaire_reponses, horaires_ouverture, siret, code_ape")
      .limit(1)
      .maybeSingle();

    const { data: ssiDocs } = await supabase
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
        ? Object.entries(entreprise.questionnaire_reponses)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "";

      const horaires = entreprise.horaires_ouverture
        ? Object.entries(entreprise.horaires_ouverture as Record<string, {ouvert:boolean;ouverture:string;fermeture:string}>)
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
Exemple : si c'est une Discothèque Type P,
ne pose pas de questions pour savoir quel type
d'établissement c'est — tu le sais déjà.
═══════════════════════════════════════`;
    }

    let documentContext = "";
    if (ssiDocs && ssiDocs.length > 0) {
      documentContext = `

═══════════════════════════════════════
DOCUMENTS SSI ET PROCÉDURES
═══════════════════════════════════════
${ssiDocs.map((doc: {categorie:string;titre:string;contenu:string}) =>
  `--- ${doc.categorie} : ${doc.titre} ---\n${doc.contenu}`
).join("\n\n")}
═══════════════════════════════════════`;
    }

    let experts: string[] = ["terrain"];
    if (iaSettings.prompt_router && iaSettings.prompt_router.trim() !== "") {
      try {
        const routerRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${iaSettings.openai_api_key}`,
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
        });
        const routerData = await routerRes.json();
        const routerText = routerData.choices?.[0]?.message?.content?.trim() ?? '["terrain"]';
        const parsed = JSON.parse(routerText);
        if (Array.isArray(parsed)) experts = parsed;
      } catch {
        experts = ["terrain"];
      }
    }

    if (mode === "erp") experts = ["erp"];
    if (mode === "bruit") experts = ["bruit"];
    if (mode === "terrain") experts = ["terrain"];

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

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${iaSettings.openai_api_key}`,
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
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) {
      return new Response(
        JSON.stringify({ error: openaiData.error?.message || "Erreur OpenAI" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const content = openaiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ response: content, experts: experts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
