import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BO_BASE_URL = "https://adminapip.arena365backend.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser();

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { leadId, reason } = body as {
      leadId?: string;
      reason?: string;
    };

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "leadId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await adminClient
      .from("leads")
      .select("id, username, assigned_agent_id, bo_user_id, bo_sync_status")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const boUserId = lead.username;
    if (!boUserId) {
      return new Response(
        JSON.stringify({ error: "Lead has no username (BO userId)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agent
    const agentId = lead.assigned_agent_id;
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "Lead has no assigned agent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: agent, error: agentErr } = await adminClient
      .from("agents")
      .select("id, full_name, referral_code")
      .eq("id", agentId)
      .single();

    if (agentErr || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentName = agent.full_name;
    const crmAgentId = agent.referral_code || agent.id;

    // Check for existing synced mapping with same agent (dedup)
    const { data: existingMapping } = await adminClient
      .from("bo_agent_mappings")
      .select("id, agent_id, sync_status")
      .eq("lead_id", leadId)
      .eq("agent_id", agentId)
      .eq("sync_status", "synced")
      .maybeSingle();

    if (existingMapping) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Already synced",
          mappingId: existingMapping.id,
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for previous agent mapping (reassignment tracking)
    const { data: prevMapping } = await adminClient
      .from("bo_agent_mappings")
      .select("agent_id, agent_name")
      .eq("lead_id", leadId)
      .neq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Insert mapping record
    const { data: mappingRecord, error: insertErr } = await adminClient
      .from("bo_agent_mappings")
      .insert({
        lead_id: leadId,
        agent_id: agentId,
        agent_name: agentName,
        bo_user_id: boUserId,
        sync_status: "pending",
        mapping_reason: reason || "call_completed",
        previous_agent_id: prevMapping?.agent_id || null,
        previous_agent_name: prevMapping?.agent_name || null,
      })
      .select("id")
      .single();

    if (insertErr || !mappingRecord) {
      console.error("Failed to insert mapping record:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create mapping record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call BO API
    let boSuccess = false;
    let boMessage = "";
    let boData: Record<string, unknown> | null = null;

    try {
      const boResponse = await fetch(`${BO_BASE_URL}/v1/callingAgent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: boUserId,
          agentId: String(crmAgentId),
          agentName: agentName,
        }),
      });

      const boPayload = await boResponse.json();
      boSuccess = boPayload?.status === true;
      boMessage = boPayload?.message || "";
      boData = boPayload?.data || null;

      if (!boSuccess) {
        console.error("BO API returned failure:", boPayload);
      }
    } catch (boErr) {
      boMessage = boErr instanceof Error ? boErr.message : "BO API request failed";
      console.error("BO API call error:", boErr);
    }

    // Update mapping record with result
    const now = new Date().toISOString();
    await adminClient
      .from("bo_agent_mappings")
      .update({
        sync_status: boSuccess ? "synced" : "failed",
        synced_at: boSuccess ? now : null,
        last_error: boSuccess ? null : boMessage,
        bo_response: boData ? boData : { message: boMessage },
        retry_count: boSuccess ? 0 : 1,
        updated_at: now,
      })
      .eq("id", mappingRecord.id);

    // Update lead's BO sync status
    await adminClient
      .from("leads")
      .update({
        bo_user_id: boUserId,
        bo_sync_status: boSuccess ? "synced" : "failed",
        bo_synced_at: boSuccess ? now : null,
        bo_sync_error: boSuccess ? null : boMessage,
      })
      .eq("id", leadId);

    return new Response(
      JSON.stringify({
        success: boSuccess,
        message: boSuccess ? "Agent mapping synced to Back Office" : boMessage,
        mappingId: mappingRecord.id,
        boResponse: boData,
      }),
      {
        status: boSuccess ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("sync-calling-agent error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
