import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
    const body = await req.json();
    const { message, mode = "terrain" } = body;

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
      .select("prompt, openai_api_key, gpt_model, prompt_erp, gpt_model_erp, prompt_bruit, gpt_model_bruit")
      .limit(1)
      .maybeSingle();

    if (!iaSettings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: "Assistant IA non configuré." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Select prompt and model based on mode
    let systemPrompt: string;
    let gptModel: string;

    if (mode === "erp") {
      systemPrompt = iaSettings.prompt_erp || "";
      gptModel = iaSettings.gpt_model_erp || "gpt-4o";
    } else if (mode === "bruit") {
      systemPrompt = iaSettings.prompt_bruit || "";
      gptModel = iaSettings.gpt_model_bruit || "gpt-4o";
    } else {
      // terrain (default)
      const { data: ssiDocs } = await supabase
        .from("toolbox_documents")
        .select("titre, contenu, categorie")
        .in("categorie", ["SSI", "PROCEDURE"])
        .eq("actif", true)
        .order("ordre", { ascending: true });

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

      systemPrompt = (iaSettings.prompt || "") + documentContext;
      gptModel = iaSettings.gpt_model || "gpt-4o";
    }

    const maxTokens = mode === "erp" ? 4000 : 1500;

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

    // If ERP mode: also sync to toolbox_documents
    if (mode === "erp" && content) {
      const now = new Date().toISOString();
      const dateFR = new Date().toLocaleDateString("fr-FR");

      // Update entreprise document
      await supabase
        .from("entreprise")
        .update({
          document_obligations_html: content,
          document_obligations_updated_at: now,
        })
        .not("id", "is", null);

      // Sync to toolbox_documents
      await supabase
        .from("toolbox_documents")
        .upsert({
          titre: "Mes obligations réglementaires",
          categorie: "PROCEDURE",
          description: `Mis à jour le ${dateFR}`,
          contenu: content,
          destinataires: ["Direction", "Chef de poste"],
          actif: true,
          ordre: 0,
          signature_requise: false,
        }, { onConflict: "titre" });
    }

    return new Response(
      JSON.stringify({ response: content }),
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
