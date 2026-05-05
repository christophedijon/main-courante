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
    const { message } = await req.json();

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
      .select("prompt, openai_api_key, gpt_model")
      .limit(1)
      .maybeSingle();

    if (!iaSettings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: "Assistant IA non configuré." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${iaSettings.openai_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: iaSettings.gpt_model || "gpt-4o",
        messages: [
          { role: "system", content: iaSettings.prompt || "" },
          { role: "user", content: message },
        ],
        max_tokens: 1000,
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
