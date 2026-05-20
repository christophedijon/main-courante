import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-flic-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Secret header check
    const flicSecret = Deno.env.get("FLIC_HUB_SECRET");
    if (flicSecret) {
      const provided = req.headers.get("x-flic-secret");
      if (provided !== flicSecret) {
        return json({ success: false, error: "Unauthorized" }, 401);
      }
    }

    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const action: string = body?.action;
    const source: string = body?.source ?? "flic";

    if (!["entree", "sortie", "reset"].includes(action)) {
      return json({ success: false, error: "Invalid action. Expected: entree | sortie | reset" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch entreprise_id
    const { data: entreprise, error: entErr } = await supabase
      .from("entreprise")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (entErr || !entreprise) {
      return json({ success: false, error: "entreprise not found" }, 500);
    }

    const entrepriseId: string = entreprise.id;

    if (action === "reset") {
      const { data, error } = await supabase.rpc("reset_jauge", {
        p_entreprise_id: entrepriseId,
        p_user_id: null,
      });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, count: data ?? 0 });
    }

    const delta = action === "entree" ? 1 : -1;

    const { data, error } = await supabase.rpc("increment_jauge", {
      p_entreprise_id: entrepriseId,
      p_delta: delta,
      p_source: source,
      p_user_id: null,
    });

    if (error) return json({ success: false, error: error.message }, 500);

    return json({ success: true, count: data ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return json({ success: false, error: message }, 500);
  }
});
