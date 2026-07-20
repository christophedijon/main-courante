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
    // Shared secret — fail closed if not configured.
    const flicSecret = Deno.env.get("FLIC_HUB_SECRET");
    if (!flicSecret) {
      console.error("[flic-jauge] FLIC_HUB_SECRET not configured");
      return json({ success: false, error: "Service unavailable" }, 500);
    }
    const provided = req.headers.get("x-flic-secret");
    if (provided !== flicSecret) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const action: string = body?.action;
    const source: string = body?.source ?? "flic";
    // The Flic Hub package must identify itself. We accept either:
    //   { mac: "<hub-mac>", bid: "<button-id>" }   (recommended)
    //   { "serial-number": "<button-serial>" }     (legacy Flic Cloud Buttons format)
    //   { button_mac, button_bid }                 (snake_case alias)
    const buttonMac: string | undefined =
      body?.mac ?? body?.button_mac ?? body?.["serial-number"];
    const buttonBid: string | undefined = body?.bid ?? body?.button_bid ?? null;

    if (!["entree", "sortie", "reset"].includes(action)) {
      return json({ success: false, error: "Invalid action. Expected: entree | sortie | reset" }, 400);
    }
    if (!buttonMac) {
      return json(
        { success: false, error: "Missing button identifier (mac / serial-number)" },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve the button → establishment mapping. No fallback: if the physical
    // button is not registered, we refuse to touch any jauge.
    let mappingQuery = supabase
      .from("flic_buttons")
      .select("etablissement_id")
      .eq("button_mac", buttonMac);

    if (buttonBid) {
      mappingQuery = mappingQuery.eq("button_bid", buttonBid);
    } else {
      // Single-button hub: match the row whose button_bid is NULL.
      mappingQuery = mappingQuery.is("button_bid", null);
    }

    const { data: mapping, error: mapErr } = await mappingQuery.maybeSingle();

    if (mapErr) {
      console.error("[flic-jauge] mapping lookup failed:", mapErr);
      return json({ success: false, error: "Service unavailable" }, 500);
    }
    if (!mapping) {
      console.warn(`[flic-jauge] no mapping for mac=${buttonMac} bid=${buttonBid ?? 'null'}`);
      return json(
        { success: false, error: "Button not registered to any establishment" },
        404,
      );
    }

    const etablissementId: string = mapping.etablissement_id;

    // An establishment in "automatique" mode is driven by Zapsis, not by Flic.
    // Ignore Flic actions to avoid corrupting the Zapsis-derived count.
    const { data: etab, error: etabErr } = await supabase
      .from("etablissements")
      .select("mode_jauge")
      .eq("id", etablissementId)
      .maybeSingle();

    if (etabErr || !etab) {
      console.error("[flic-jauge] etablissement lookup failed:", etabErr);
      return json({ success: false, error: "Service unavailable" }, 500);
    }

    if (etab.mode_jauge === "automatique") {
      return json(
        { success: false, error: "Establishment is in automatic (Zapsis) mode; Flic actions ignored" },
        409,
      );
    }

    if (action === "reset") {
      const { data, error } = await supabase.rpc("reset_jauge", {
        p_etablissement_id: etablissementId,
        p_user_id: null,
      });
      if (error) {
        console.error("[flic-jauge] reset_jauge rpc error:", error);
        return json({ success: false, error: "An error occurred processing your request." }, 500);
      }
      return json({ success: true, count: data ?? 0 });
    }

    const delta = action === "entree" ? 1 : -1;

    const { data, error } = await supabase.rpc("increment_jauge", {
      p_etablissement_id: etablissementId,
      p_delta: delta,
      p_source: source,
      p_user_id: null,
    });

    if (error) {
      console.error("[flic-jauge] increment_jauge rpc error:", error);
      return json({ success: false, error: "An error occurred processing your request." }, 500);
    }

    return json({ success: true, count: data ?? 0 });
  } catch (err: unknown) {
    console.error("[flic-jauge] unhandled error:", err);
    return json({ success: false, error: "An error occurred processing your request." }, 500);
  }
});
