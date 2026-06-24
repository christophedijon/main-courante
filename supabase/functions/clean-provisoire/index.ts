import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get("ALLOWED_ORIGIN") || "https://maincourante21.bolt.host",
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const now = new Date().toISOString();

    const { data: expiredUsers, error: fetchErr } = await supabase
      .from('managed_users')
      .select('auth_user_id, email')
      .eq('is_provisoire', true)
      .lt('provisoire_expires_at', now);

    if (fetchErr) {
      console.error("[clean-provisoire] managed_users fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: "An error occurred processing your request." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucun compte expiré' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deleted = 0;
    for (const user of expiredUsers) {
      if (user.auth_user_id) {
        await supabase.auth.admin.deleteUser(user.auth_user_id);
      }
      await supabase
        .from('managed_users')
        .delete()
        .eq('auth_user_id', user.auth_user_id);
      deleted++;
    }

    return new Response(
      JSON.stringify({ deleted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error("[clean-provisoire] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
