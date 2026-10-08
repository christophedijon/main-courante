import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { target_email } = await req.json();
    if (!target_email) {
      return json({ error: 'target_email requis' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Non autorisé' }, 401);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'Session invalide' }, 401);
    }

    // Check caller is Direction or Chef de poste
    const { data: callerManaged } = await adminClient
      .from('managed_users')
      .select('fonction, etablissement_id')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    const { data: callerAdmin } = await adminClient
      .from('super_admins')
      .select('id')
      .eq('email', caller.email!)
      .maybeSingle();

    const isSuperAdmin = !!callerAdmin;
    const callerFonction = callerManaged?.fonction ?? null;
    const isAuthorized = isSuperAdmin || callerFonction === 'Direction' || callerFonction === 'Chef de poste';

    if (!isAuthorized) {
      return json({ error: 'Permission refusée' }, 403);
    }

    // Get target user and verify same etablissement
    const { data: targetUser } = await adminClient
      .from('managed_users')
      .select('email, fonction, etablissement_id, auth_user_id')
      .eq('email', target_email)
      .maybeSingle();

    if (!targetUser) {
      return json({ error: 'Utilisateur cible introuvable' }, 404);
    }

    // Same-etablissement check (skip for super admin)
    if (!isSuperAdmin) {
      if (!callerManaged?.etablissement_id || callerManaged.etablissement_id !== targetUser.etablissement_id) {
        return json({ error: 'Vous ne pouvez relancer que les agents de votre établissement' }, 403);
      }
    }

    // Get unsigned documents for the target user (filtered by caller's etablissement)
    const { data: docs } = await adminClient
      .from('toolbox_documents')
      .select('id, titre, destinataires, content_version')
      .eq('actif', true)
      .eq('signature_requise', true)
      .eq('etablissement_id', targetUser.etablissement_id);

    if (!docs || docs.length === 0) {
      return json({ error: 'Aucun document à signer pour cet utilisateur' }, 400);
    }

    // Filter relevant docs by destinataires
    const targetFonction = targetUser.fonction ?? '';
    const relevant = docs.filter((d: { destinataires: string[] | null }) =>
      !d.destinataires || d.destinataires.length === 0 || d.destinataires.includes(targetFonction)
    );

    if (relevant.length === 0) {
      return json({ error: 'Aucun document à signer pour cet utilisateur' }, 400);
    }

    // Get target user's signatures
    const targetAuthId = targetUser.auth_user_id;
    if (!targetAuthId) {
      return json({ error: 'Utilisateur sans compte auth' }, 400);
    }

    const { data: sigs } = await adminClient
      .from('signatures')
      .select('document_id, content_version')
      .eq('agent_id', targetAuthId);

    const signedSet = new Set(
      (sigs ?? []).map((s: { document_id: string; content_version: number }) =>
        `${s.document_id}:${s.content_version}`
      )
    );

    const unsignedDocs = relevant.filter(
      (d: { id: string; content_version: number }) =>
        !signedSet.has(`${d.id}:${d.content_version}`)
    );

    if (unsignedDocs.length === 0) {
      return json({ error: 'Tous les documents sont déjà signés' }, 400);
    }

    // Build email
    const rawAppUrl = Deno.env.get('APP_URL') ?? 'https://app.maincourante.eu';
    const appUrl = rawAppUrl.includes('bolt.host') ? 'https://app.maincourante.eu' : rawAppUrl;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'L\'équipe Main Courante <noreply@send.maincourante.eu>';

    if (!resendKey) {
      return json({ error: 'Service email non configuré' }, 500);
    }

    const resend = new Resend(resendKey);

    const docListHtml = unsignedDocs
      .map((d: { titre: string }) => `<li style="padding:8px 0;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px;">${d.titre}</li>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden">
    <div style="padding:32px 32px 24px">
      <p style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 8px">Main Courante</p>
      <h1 style="color:#ffffff;font-size:22px;font-weight:800;margin:0 0 8px">Rappel : documents à signer</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0">Il vous reste ${unsignedDocs.length} document${unsignedDocs.length > 1 ? 's' : ''} à lire et signer.</p>
    </div>
    <div style="padding:0 32px 16px">
      <ul style="list-style:none;padding:0;margin:0">${docListHtml}</ul>
    </div>
    <div style="padding:0 32px 24px;text-align:center">
      <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none">Voir mes documents</a>
    </div>
    <div style="padding:16px 32px 28px;border-top:1px solid #1e293b">
      <p style="color:#475569;font-size:12px;margin:0">Cet email a été envoyé automatiquement par Main Courante. Si vous avez déjà signé ces documents, vous pouvez ignorer ce message.</p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: fromEmail,
      to: target_email,
      subject: `[Main Courante] Rappel : ${unsignedDocs.length} document${unsignedDocs.length > 1 ? 's' : ''} à signer`,
      html,
    });

    return json({ success: true, sent_to: target_email, unsigned_count: unsignedDocs.length });
  } catch (err) {
    console.error('[send-signature-rappel] error:', err);
    return json({ error: 'An error occurred processing your request.' }, 500);
  }
});
