import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

type AdminDeleteUserRequest = {
  userId?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for admin-delete-user function");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = (await req.json()) as AdminDeleteUserRequest;

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

    const { error: deleteError } = await supabase.auth.admin.deleteUser(
      body.userId,
    );

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const profileCleanup = supabase
      .from("user_profiles")
      .delete()
      .eq("id", body.userId);

    const rolesCleanup = supabase
      .from("user_roles")
      .delete()
      .eq("user_id", body.userId);

    const [{ error: profileError }, { error: rolesError }] = await Promise.all([
      profileCleanup,
      rolesCleanup,
    ]);

    if (profileError || rolesError) {
      return new Response(
        JSON.stringify({
          error: "cleanup_failed",
          details: profileError?.message ?? rolesError?.message ?? "",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
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
