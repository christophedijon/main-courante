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
    const { email, password, appUrl } = await req.json() as {
      email: string;
      password: string;
      appUrl: string;
    };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@send.maincourante.eu";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden">
    <div style="padding:32px 32px 24px">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Main Courante</p>
      <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 8px">Vos identifiants de connexion</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0">Un compte provisoire a été créé pour vous.</p>
    </div>
    <div style="padding:0 32px 24px">
      <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
        <tr>
          <td style="padding:12px 16px;background:#1e293b;color:#94a3b8;font-size:13px;font-weight:600;width:110px">Email</td>
          <td style="padding:12px 16px;background:#1e293b;color:#f1f5f9;font-family:monospace;font-size:14px">${email}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#0f172a;border:1px solid #1e293b;color:#94a3b8;font-size:13px;font-weight:600">Mot de passe</td>
          <td style="padding:12px 16px;background:#0f172a;border:1px solid #1e293b;color:#f1f5f9;font-family:monospace;font-size:14px">${password}</td>
        </tr>
      </table>
    </div>
    <div style="padding:0 32px 24px;text-align:center">
      <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none">${appUrl}</a>
    </div>
    <div style="padding:16px 32px 28px;border-top:1px solid #1e293b">
      <p style="color:#475569;font-size:12px;margin:0">Ce compte est provisoire (valable 48h). Pensez à compléter votre profil dès votre première connexion.</p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "[Main Courante] Vos identifiants de connexion",
      html,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[send-credentials] error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
