import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Não autorizado');
    }

    // Check if user is admin or gestor_master
    const { data: userRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      throw new Error('Erro ao verificar permissões');
    }

    const roles = userRoles?.map(r => r.role) || [];
    const canManage = roles.includes('admin') || roles.includes('gestor_master');

    if (!canManage) {
      throw new Error('Acesso negado. Apenas admin e gestor_master podem atualizar usuários.');
    }

    const { userId, email, password, fullName, roles: newUserRoles, tipo } = await req.json();

    console.log('Updating user:', { userId, email, fullName, roles: newUserRoles, tipo });

    // Update user email and password if provided
    const updateData: any = {
      email,
      user_metadata: {
        full_name: fullName,
      },
    };

    if (password) {
      updateData.password = password;
    }

    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      updateData
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
      throw updateError;
    }

    console.log('User updated:', userId);

    // Delete existing roles
    const { error: deleteRolesError } = await supabaseClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (deleteRolesError) {
      console.error('Error deleting roles:', deleteRolesError);
      throw new Error(`Erro ao atualizar funções: ${deleteRolesError.message}`);
    }

    // Insert new roles
    if (newUserRoles && Array.isArray(newUserRoles) && newUserRoles.length > 0) {
      const roleInserts = newUserRoles.map(role => ({
        user_id: userId,
        role,
      }));

      const { error: rolesInsertError } = await supabaseClient
        .from('user_roles')
        .insert(roleInserts);

      if (rolesInsertError) {
        console.error('Error inserting roles:', rolesInsertError);
        throw new Error(`Erro ao atribuir novas funções: ${rolesInsertError.message}`);
      }

      console.log('Roles updated:', roleInserts);
    }

    // Update profile
    const { error: profileError } = await supabaseClient
      .from('user_profiles')
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        display_name: fullName,
        tipo,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Continue anyway
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in update-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
