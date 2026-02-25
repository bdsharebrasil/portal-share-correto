import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

type AppRole =
  | "admin"
  | "tripulante"
  | "financeiro"
  | "financeiro_master"
  | "piloto_chefe"
  | "operacoes";

type UserCategory = "colaboradores" | "fornecedores" | "clientes";

type PasswordStrength = {
  lengthOk: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  valid: boolean;
};

type AdminCreateUserRequest = {
  email?: string;
  password?: string;
  roles?: AppRole[];
  fullName?: string;
  tipo?: UserCategory | null;
};

type SupabaseUser = {
  id: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for admin-create-user function");
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

    const body = (await req.json()) as AdminCreateUserRequest;

    if (!body.email || !body.password) {
      return new Response("email and password required", { status: 400 });
    }

    const strength = passwordStrength(body.password);

    if (!strength.valid) {
      return new Response(
        JSON.stringify({
          error: "weak_password",
          details: strength,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const uniqueRoles = Array.isArray(body.roles)
      ? Array.from(new Set(body.roles))
      : [];

    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        roles: uniqueRoles,
      },
    });

    if (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const createdUser = data.user as SupabaseUser | null;

    if (!createdUser?.id) {
      return new Response(
        JSON.stringify({ error: "user_creation_failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (uniqueRoles.length > 0) {
      const rows = uniqueRoles.map((role) => ({
        user_id: createdUser.id,
        role,
      }));

      const { error: rolesError } = await supabase.from("user_roles").insert(rows);

      if (rolesError) {
        return new Response(
          JSON.stringify({
            error: "role_assignment_failed",
            details: rolesError.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    const profilePayload = {
      id: createdUser.id,
      email: body.email,
      full_name: body.fullName ?? body.email,
      display_name: body.fullName ?? body.email,
      tipo: body.tipo ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      return new Response(
        JSON.stringify({
          error: "profile_upsert_failed",
          details: profileError.message,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    await supabase.auth.admin.updateUserById(createdUser.id, {
      email_confirm: false,
    });

    return new Response(
      JSON.stringify({
        user: data.user,
        strength,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
