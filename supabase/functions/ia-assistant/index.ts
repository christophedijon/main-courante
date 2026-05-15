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

    // ── Mode ERP ou Bruit : comportement direct (appelé depuis le back-office) ──
    if (mode === "erp" || mode === "bruit") {
      const systemPrompt = mode === "erp"
        ? (iaSettings.prompt_erp || "")
        : (iaSettings.prompt_bruit || "");
      const gptModel = mode === "erp"
        ? (iaSettings.gpt_model_erp || "gpt-4o")
        : (iaSettings.gpt_model_bruit || "gpt-4o");

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${iaSettings.openai_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: gptModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          max_tokens: 4000,
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
        JSON.stringify({ response: content, experts: [mode] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mode terrain avec routage intelligent ──────────────────────────────────
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

        if (routerRes.ok) {
          const routerData = await routerRes.json();
          const routerText = routerData.choices?.[0]?.message?.content?.trim() ?? '["terrain"]';
          const parsed = JSON.parse(routerText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            experts = parsed;
          }
        }
      } catch {
        experts = ["terrain"];
      }
    }

    // ── Construire le prompt combiné selon les experts détectés ────────────────
    const promptParts: string[] = [];

    if (experts.includes("terrain") && iaSettings.prompt) {
      let documentContext = "";
      if (ssiDocs && ssiDocs.length > 0) {
        documentContext = `

═══════════════════════════════════════
DOCUMENTS DE RÉFÉRENCE SSI ET PROCÉDURES
═══════════════════════════════════════
Les documents suivants sont les procédures
officielles de l'établissement.
Tu DOIS les consulter pour construire
ta réponse et t'y référer explicitement
quand c'est pertinent.

${ssiDocs.map((doc) => `--- ${doc.categorie} : ${doc.titre} ---\n${doc.contenu}`).join("\n\n")}
═══════════════════════════════════════`;
      }

      promptParts.push(`=== EXPERT SÉCURITÉ TERRAIN ===\n${iaSettings.prompt}${documentContext}`);
    }

    if (experts.includes("erp") && iaSettings.prompt_erp) {
      promptParts.push(`=== EXPERT RÉGLEMENTATION ERP ===\n${iaSettings.prompt_erp}`);
    }

    if (experts.includes("bruit") && iaSettings.prompt_bruit) {
      promptParts.push(`=== EXPERT BRUIT ET ACOUSTIQUE ===\n${iaSettings.prompt_bruit}`);
    }

    let combinedPrompt = promptParts.length > 0
      ? promptParts.join("\n\n")
      : (iaSettings.prompt || "");

    if (promptParts.length > 1) {
      combinedPrompt += `\n\n=== INSTRUCTION DE SYNTHÈSE ===\nTu combines les expertises ci-dessus pour répondre à cette question.\nStructure ta réponse en 4 blocs clairs.\nCommence par identifier les dimensions de la question (terrain / ERP / bruit) puis réponds à chacune.`;
    }

    const maxTokens = experts.includes("erp") ? 4000 : 1500;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${iaSettings.openai_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: iaSettings.gpt_model || "gpt-4o",
        messages: [
          { role: "system", content: combinedPrompt },
          { role: "user", content: message },
        ],
        max_tokens: maxTokens,
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
      JSON.stringify({ response: content, experts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
