import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier l'identité de l'invitant
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: 'Permission refusée' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, password, fonction, invited_by } = await req.json();

    if (!email || !password || !fonction) {
      return new Response(JSON.stringify({ error: 'Champs manquants' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chef de poste ne peut inviter que des Agents de Sécurité
    if (isChefDePoste && fonction !== 'Agent de Sécurité') {
      return new Response(JSON.stringify({ error: 'Un Chef de poste ne peut inviter que des Agents de Sécurité' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedFonctions = ['Direction', 'Chef de poste', 'Agent de Sécurité', 'Serveur'];
    if (!allowedFonctions.includes(fonction)) {
      return new Response(JSON.stringify({ error: 'Fonction non autorisée' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Créer le compte auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: authErr?.message ?? 'Erreur création compte' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      // Rollback auth user if managed_users insert failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: managedErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, email, managed_user: managedData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
