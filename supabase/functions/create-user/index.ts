import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

type AppRole = 
  | "admin"
  | "cliente"
  | "tripulante"
  | "financeiro"
  | "financeiro_master"
  | "piloto_chefe"
  | "operacoes"
  | "rh"
  | "adm"
  | "coordenador_de_voo";

type CreateUserRequest = {
  email: string;
  password: string;
  role: AppRole;
  userType: "cliente" | "colaborador";
  clientId?: string;
  profileData?: Record<string, any>;
};

type PasswordStrength = {
  lengthOk: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  valid: boolean;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("Environment check - SUPABASE_URL:", supabaseUrl ? "set" : "not set");
console.log("Environment check - SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "set" : "not set");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase configuration");
  console.error("Available env vars:", Object.keys(Deno.env.toObject()));
  throw new Error("Missing Supabase configuration for create-user function");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const passwordStrength = (password: string): PasswordStrength => {
  const lengthOk = password.length >= 6;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);

  return {
    lengthOk,
    upper,
    lower,
    digit,
    special,
    valid: lengthOk,
  };
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body: CreateUserRequest;
    try {
      body = (await req.json()) as CreateUserRequest;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Create user request received:", { email: body.email, role: body.role, userType: body.userType });

    if (!body.email || !body.password) {
      console.error("Missing email or password");
      return new Response(
        JSON.stringify({ error: "email and password required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.role) {
      console.error("Missing role");
      return new Response(
        JSON.stringify({ error: "role required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const strength = passwordStrength(body.password);

    if (!strength.valid) {
      console.error("Password validation failed:", strength);
      return new Response(
        JSON.stringify({
          error: "weak_password",
          details: strength,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create auth user
    console.log("Creating auth user for email:", body.email);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        role: body.role,
        userType: body.userType,
      },
    });

    if (authError) {
      console.error("Auth user creation error:", authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Auth user created successfully with ID:", authData.user?.id);

    const userId = authData.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_creation_failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Assign role in user_roles table
    console.log("Assigning role to user:", { userId, role: body.role });
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: body.role });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      return new Response(
        JSON.stringify({
          error: `Role assignment failed: ${roleError.message}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Role assigned successfully");

    // Create or update profile
    const profilePayload: Record<string, any> = {
      id: userId,
      email: body.email,
      display_name: body.profileData?.full_name || body.email,
      full_name: body.profileData?.full_name || body.email,
      tipo: body.userType === "cliente" ? "cliente" : "colaborador",
      updated_at: new Date().toISOString(),
    };

    // Add additional profile data for colaborador
    if (body.userType === "colaborador" && body.profileData) {
      Object.assign(profilePayload, body.profileData);
    }

    // Add client_id for cliente
    if (body.userType === "cliente" && body.clientId) {
      profilePayload.client_id = body.clientId;
    }

    console.log("Creating profile with payload:", { id: userId, tipo: profilePayload.tipo, has_client_id: !!profilePayload.client_id });
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return new Response(
        JSON.stringify({
          error: `Profile creation failed: ${profileError.message}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Profile created successfully");

    return new Response(
      JSON.stringify({
        user: authData.user,
        success: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
