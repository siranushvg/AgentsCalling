import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use anon client to verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, phone, city, languages, role, voicelay_username, voicelay_extension, monthly_salary, joining_date, referred_by } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, full_name, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["agent", "team_lead", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user with service role (auto-confirms)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // The handle_new_user trigger creates profile + user_roles automatically.
    // For agent/team_lead, also create an agents record.
    if (role === "agent" || role === "team_lead") {
      // Generate referral code
      const { data: refCode } = await adminClient.rpc("generate_referral_code", {
        agent_name: full_name,
      });

      // Validate referred_by code if provided
      let validatedReferredBy: string | null = null;
      if (referred_by && typeof referred_by === "string" && referred_by.trim()) {
        const trimmed = referred_by.trim().toUpperCase();
        // Prevent self-referral
        const generatedCode = refCode || full_name.substring(0, 5).toUpperCase() + "000";
        if (trimmed !== generatedCode) {
          const { data: referrer } = await adminClient
            .from("agents")
            .select("id, referral_code")
            .eq("referral_code", trimmed)
            .maybeSingle();
          if (referrer) {
            validatedReferredBy = trimmed;
          } else {
            console.warn(`Referral code '${trimmed}' not found, ignoring`);
          }
        } else {
          console.warn("Self-referral attempt blocked");
        }
      }

      const agentRecord: any = {
        user_id: userId,
        full_name,
        email,
        phone: phone || "",
        city: city || "",
        languages: languages || [],
        referral_code: refCode || full_name.substring(0, 5).toUpperCase() + "000",
        referred_by: validatedReferredBy,
        status: "pending",
        voicelay_username: voicelay_username || null,
        voicelay_extension: voicelay_extension ? Number(voicelay_extension) : null,
        monthly_salary: monthly_salary ? Number(monthly_salary) : 0,
      };
      if (joining_date) agentRecord.joining_date = joining_date;

      const { error: agentErr } = await adminClient.from("agents").insert(agentRecord);

      if (agentErr) {
        console.error("Agent record creation failed:", agentErr);
        return new Response(JSON.stringify({ error: "User created but agent record failed: " + agentErr.message, userId }), {
          status: 207,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, userId, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-create-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
