import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("ALLOWED_ORIGIN") || "https://maincourante21.bolt.host",
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Non autorisé' }, 401);
    }

    // Vérifier l'identité de l'invitant
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'Session invalide' }, 401);
    }

    // Récupérer la fonction de l'invitant
    const { data: callerManaged } = await supabase
      .from('managed_users')
      .select('fonction')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    // Vérifier dans super_admins aussi
    const { data: callerAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('email', caller.email!)
      .maybeSingle();

    const callerFonction = callerManaged?.fonction ?? null;
    const isDirection = callerFonction === 'Direction' || !!callerAdmin;
    const isChefDePoste = callerFonction === 'Chef de poste';

    if (!isDirection && !isChefDePoste) {
      return json({ error: 'Permission refusée' }, 403);
    }

    const { email, password, fonction, invited_by } = await req.json();

    if (!email || !password || !fonction) {
      return json({ error: 'Champs manquants' }, 400);
    }

    // Chef de poste ne peut inviter que des Agents de Sécurité
    if (isChefDePoste && fonction !== 'Agent de Sécurité') {
      return json({ error: 'Un Chef de poste ne peut inviter que des Agents de Sécurité' }, 403);
    }

    const allowedFonctions = ['Direction', 'Chef de poste', 'Agent de Sécurité', 'Serveur'];
    if (!allowedFonctions.includes(fonction)) {
      return json({ error: 'Fonction non autorisée' }, 400);
    }

    // Créer le compte auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      // Supabase auth errors (e.g. "email already registered") are safe to surface
      return json({ error: authErr?.message ?? 'Erreur création compte' }, 400);
    }

    // Créer l'entrée managed_users
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: managedData, error: managedErr } = await supabase
      .from('managed_users')
      .insert({
        email,
        fonction,
        status: 'active',
        auth_user_id: authData.user.id,
        is_provisoire: true,
        provisoire_expires_at: expiresAt,
        profile_completed: false,
        invited_by: invited_by ?? caller.id,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (managedErr) {
      console.error("[invite-user] managed_users insert error:", managedErr);
      // Rollback auth user if managed_users insert failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      return json({ error: 'An error occurred processing your request.' }, 500);
    }

    return json({ success: true, email, managed_user: managedData });
  } catch (err) {
    console.error("[invite-user] unhandled error:", err);
    return json({ error: 'An error occurred processing your request.' }, 500);
  }
});
