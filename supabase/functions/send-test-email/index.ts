import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend";

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
    const { to, subject, html } = await req.json() as {
      to: string | string[];
      subject: string;
      html: string;
    };

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "to, subject and html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";

    const recipients = Array.isArray(to) ? to : [to];
    for (const recipient of recipients) {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject,
        html,
      });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[send-test-email] error:", err);
    const message = err instanceof Error ? err.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
