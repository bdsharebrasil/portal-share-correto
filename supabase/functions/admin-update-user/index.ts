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

type AdminUpdateUserRequest = {
  userId?: string;
  email?: string;
  password?: string;
  roles?: AppRole[] | null;
  fullName?: string;
  tipo?: UserCategory | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for admin-update-user function");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const passwordStrength = (password: string): PasswordStrength => {
  const lengthOk = password.length >= 8;
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
    valid: lengthOk && upper && lower && digit && special,
  };
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = (await req.json()) as AdminUpdateUserRequest;

    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: "user_id_required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (body.password) {
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
    }

    const uniqueRoles = Array.isArray(body.roles)
      ? Array.from(new Set(body.roles))
      : null;

    const updates: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (body.email) {
      updates.email = body.email;
    }

    if (body.password) {
      updates.password = body.password;
    }

    if (uniqueRoles !== null) {
      updates.user_metadata = { roles: uniqueRoles };
    }

    let updatedUser = null;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        body.userId,
        updates,
      );

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      updatedUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.getUserById(body.userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      updatedUser = data.user;
    }

    if (uniqueRoles !== null) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", body.userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: "role_cleanup_failed",
            details: deleteError.message,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (uniqueRoles.length > 0) {
        const { error: insertError } = await supabase.from("user_roles").insert(
          uniqueRoles.map((role) => ({ user_id: body.userId, role })),
        );

        if (insertError) {
          return new Response(
            JSON.stringify({
              error: "role_assignment_failed",
              details: insertError.message,
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
    }

    if (body.email || body.fullName || body.tipo) {
      const profilePayload = {
        id: body.userId,
        email: body.email ?? undefined,
        full_name: body.fullName ?? undefined,
        display_name: body.fullName ?? undefined,
        tipo: body.tipo ?? undefined,
        updated_at: new Date().toISOString(),
      };

      const sanitizedPayload = Object.fromEntries(
        Object.entries(profilePayload).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(sanitizedPayload).length > 1) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert(sanitizedPayload, { onConflict: "id" });

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
      }
    }

    return new Response(
      JSON.stringify({ user: updatedUser }),
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
      JSON.stringify({ error: "internal_error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
