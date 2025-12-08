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
      throw new Error('Acesso negado. Apenas admin e gestor_master podem criar usuários.');
    }

    const body = await req.json();
    const { 
      email, 
      password, 
      role, 
      userType, 
      profileData, 
      clientId,
      needsSystemAccess = true, // Por padrão, usuários precisam de acesso ao sistema
      fullName, 
      roles: newUserRoles, 
      tipo 
    } = body;

    console.log('Creating user:', { email, role, userType, needsSystemAccess });

    let userId: string;

    // Se precisa de acesso ao sistema, cria no auth.users
    if (needsSystemAccess && email && password) {
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: profileData?.full_name || fullName || email.split('@')[0],
        },
      });

      if (createError) {
        console.error('Error creating auth user:', createError);
        throw createError;
      }

      if (!newUser.user) {
        throw new Error('Usuário não foi criado');
      }

      userId = newUser.user.id;
      console.log('Auth user created:', userId);
    } else {
      // Se não precisa de acesso, gera um UUID para user_profiles
      userId = crypto.randomUUID();
      console.log('Creating profile-only user with ID:', userId);
    }

    // Determinar roles a inserir
    const rolesToInsert = newUserRoles || (role ? [role] : []);
    
    // Inserir roles
    if (rolesToInsert.length > 0) {
      const roleInserts = rolesToInsert.map((r: string) => ({
        user_id: userId,
        role: r,
      }));

      const { error: rolesInsertError } = await supabaseClient
        .from('user_roles')
        .insert(roleInserts);

      if (rolesInsertError) {
        console.error('Error inserting roles:', rolesInsertError);
        // Se criou usuário auth, deletar
        if (needsSystemAccess) {
          await supabaseClient.auth.admin.deleteUser(userId);
        }
        throw new Error(`Erro ao atribuir funções: ${rolesInsertError.message}`);
      }

      console.log('Roles inserted:', roleInserts);
    }

    // Criar perfil
    const profilePayload: any = {
      id: userId,
      email: profileData?.email || email,
      full_name: profileData?.full_name || fullName || email?.split('@')[0],
      display_name: profileData?.full_name || fullName || email?.split('@')[0],
      tipo: tipo || userType || 'colaborador',
      phone: profileData?.phone || null,
      birth_date: profileData?.birth_date || null,
      address: profileData?.address || null,
      company_start_date: profileData?.company_start_date || null,
      cpf: profileData?.cpf || null,
      rg: profileData?.rg || null,
      canac: profileData?.canac || null,
      department: profileData?.department || null,
    };

    // Remover campos undefined/null vazios
    Object.keys(profilePayload).forEach(key => {
      if (profilePayload[key] === undefined || profilePayload[key] === '') {
        delete profilePayload[key];
      }
    });

    // Garantir que campos obrigatórios existam
    if (!profilePayload.id) profilePayload.id = userId;
    if (!profilePayload.tipo) profilePayload.tipo = 'colaborador';

    const { error: profileError } = await supabaseClient
      .from('user_profiles')
      .insert(profilePayload);

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Continue anyway, but log the error
    } else {
      console.log('Profile created for user:', userId);
    }

    // Se for cliente, atualizar a tabela clients ou client_aircraft
    if (userType === 'cliente' && clientId) {
      // Aqui você pode adicionar lógica para associar o usuário ao cliente
      console.log('Client association would be handled for clientId:', clientId);
    }

    // Se for tripulante (piloto_chefe, tripulante, coordenador_de_voo), criar também em crew_members
    const crewRoles = ['tripulante', 'piloto_chefe', 'coordenador_de_voo'];
    const isCrewMember = rolesToInsert.some((r: string) => crewRoles.includes(r));

    if (isCrewMember) {
      // Verificar se CANAC foi fornecido
      const canac = profileData?.canac || 'PENDENTE';
      
      const { error: crewError } = await supabaseClient
        .from('crew_members')
        .insert({
          id: crypto.randomUUID(),
          user_id: needsSystemAccess ? userId : null, // Só vincula user_id se tiver auth
          full_name: profileData?.full_name || fullName || 'Nome não informado',
          canac: canac,
          email: profileData?.email || email,
          phone: profileData?.phone || null,
          birth_date: profileData?.birth_date || null,
          address: profileData?.address || null,
          cpf: profileData?.cpf || null,
          rg: profileData?.rg || null,
          status: 'active',
        });

      if (crewError) {
        console.error('Error creating crew member:', crewError);
        // Não falha a criação do usuário por isso
      } else {
        console.log('Crew member created for user:', userId);
      }
    }

    return new Response(
      JSON.stringify({ 
        user: { id: userId },
        needsSystemAccess,
        isCrewMember,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in create-user function:', error);
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
