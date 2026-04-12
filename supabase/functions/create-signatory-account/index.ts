import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
import { getAuthUserFromRequest } from "../_shared/verify_jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bearerJwt(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = bearerJwt(req);
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingApikey = req.headers.get("apikey");
    const { userId, error: authErr } = await getAuthUserFromRequest(
      supabaseUrl,
      jwt,
      anonKey,
      incomingApikey,
    );
    if (authErr || !userId) {
      return new Response(JSON.stringify({ error: authErr || "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only superadmins can create signatory accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { signatory_id, email, password, full_name } = await req.json();

    if (!signatory_id || !email || !password || !full_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if signatory exists and doesn't already have an account
    const { data: signatory, error: sigError } = await supabaseAdmin
      .from("signatories")
      .select("id, user_id")
      .eq("id", signatory_id)
      .single();

    if (sigError || !signatory) {
      return new Response(JSON.stringify({ error: "Signatory not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (signatory.user_id) {
      return new Response(JSON.stringify({ error: "Signatory already has an account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the auth user
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = createData?.user?.id;
    if (!newUserId) {
      return new Response(JSON.stringify({ error: "Account was created but user id was not returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update signatory with user_id
    const { error: updateError } = await supabaseAdmin
      .from("signatories")
      .update({ user_id: newUserId })
      .eq("id", signatory_id);

    if (updateError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Failed to link account to signatory" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace default 'student' role with 'signatory' (trigger inserts student on auth user create)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "signatory" });

    if (insertRoleError) {
      await supabaseAdmin.from("signatories").update({ user_id: null }).eq("id", signatory_id);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Failed to assign signatory role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
