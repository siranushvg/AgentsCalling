import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const allowedDispositions = new Set([
  "interested",
  "callback",
  "not_interested",
  "no_answer",
  "wrong_number",
  "language_mismatch",
  "converted",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const {
      leadId,
      callRecordId,
      disposition,
      notes,
    }: {
      leadId?: string;
      callRecordId?: string | null;
      disposition?: string;
      notes?: string | null;
    } = body;

    if (!disposition || !allowedDispositions.has(disposition)) {
      return new Response(JSON.stringify({ error: "Invalid disposition" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!leadId && !callRecordId) {
      return new Response(JSON.stringify({ error: "leadId or callRecordId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agent, error: agentError } = await adminClient
      .from("agents")
      .select("id, referral_code, referred_by")
      .eq("user_id", caller.id)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agent profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetCall: { id: string; lead_id: string; agent_id: string } | null = null;

    if (callRecordId) {
      const { data } = await adminClient
        .from("calls")
        .select("id, lead_id, agent_id")
        .eq("id", callRecordId)
        .eq("agent_id", agent.id)
        .maybeSingle();
      targetCall = data;
    }

    if (!targetCall && leadId) {
      const { data } = await adminClient
        .from("calls")
        .select("id, lead_id, agent_id")
        .eq("lead_id", leadId)
        .eq("agent_id", agent.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetCall = data;
    }

    if (!targetCall) {
      return new Response(JSON.stringify({ error: "No matching call found for this lead" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: Record<string, string | null> = {
      disposition,
      notes: notes ?? null,
    };

    const { error: updateError } = await adminClient
      .from("calls")
      .update(updatePayload)
      .eq("id", targetCall.id)
      .eq("agent_id", agent.id);

    if (updateError) {
      console.error("save-call-disposition update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auto-generate commissions on "converted" ──
    let commissionsCreated = 0;
    if (disposition === "converted") {
      try {
        const resolvedLeadId = targetCall.lead_id;

        // 1. Check if commission already exists for this lead+agent (prevent duplicates)
        const { count: existingCount } = await adminClient
          .from("commissions")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", resolvedLeadId)
          .eq("agent_id", agent.id)
          .eq("tier", "direct");

        if ((existingCount ?? 0) > 0) {
          console.log("Commission already exists for this lead, skipping");
        } else {
          // 2. Get lead's potential_commission (revenue from first deposit)
          const { data: lead } = await adminClient
            .from("leads")
            .select("potential_commission")
            .eq("id", resolvedLeadId)
            .single();

          const revenue = Number(lead?.potential_commission ?? 0);

          // 3. Fetch active commission rates
          const { data: rateRow } = await adminClient
            .from("commission_settings")
            .select("direct_rate, tier2_rate, tier3_rate")
            .order("effective_from", { ascending: false })
            .limit(1)
            .single();

          const directRate = Number(rateRow?.direct_rate ?? 30);
          const tier2Rate = Number(rateRow?.tier2_rate ?? 5);
          const tier3Rate = Number(rateRow?.tier3_rate ?? 3);

          // 4. Direct commission for the converting agent
          const directAmount = (revenue * directRate) / 100;
          if (directAmount > 0) {
            await adminClient.from("commissions").insert({
              agent_id: agent.id,
              lead_id: resolvedLeadId,
              amount: directAmount,
              rate_used: directRate,
              tier: "direct",
            });
            commissionsCreated++;
          }

          // 5. Tier 2 – find who referred the converting agent
          let tier2Agent: { id: string; referred_by: string | null } | null = null;
          if (agent.referred_by) {
            const { data } = await adminClient
              .from("agents")
              .select("id, referred_by")
              .eq("referral_code", agent.referred_by)
              .eq("status", "active")
              .maybeSingle();
            tier2Agent = data;
          }

          if (tier2Agent) {
            const tier2Amount = (revenue * tier2Rate) / 100;
            if (tier2Amount > 0) {
              await adminClient.from("commissions").insert({
                agent_id: tier2Agent.id,
                lead_id: resolvedLeadId,
                amount: tier2Amount,
                rate_used: tier2Rate,
                tier: "tier2",
                tier2_agent_id: agent.id, // the converting agent
              });
              commissionsCreated++;
            }

            // 6. Tier 3 – find who referred the tier2 agent
            if (tier2Agent.referred_by) {
              const { data: tier3Agent } = await adminClient
                .from("agents")
                .select("id")
                .eq("referral_code", tier2Agent.referred_by)
                .eq("status", "active")
                .maybeSingle();

              if (tier3Agent) {
                const tier3Amount = (revenue * tier3Rate) / 100;
                if (tier3Amount > 0) {
                  await adminClient.from("commissions").insert({
                    agent_id: tier3Agent.id,
                    lead_id: resolvedLeadId,
                    amount: tier3Amount,
                    rate_used: tier3Rate,
                    tier: "tier3",
                    tier3_agent_id: agent.id, // the converting agent
                    tier2_agent_id: tier2Agent.id, // the middle agent
                  });
                  commissionsCreated++;
                }
              }
            }
          }

          console.log(`Commissions created: ${commissionsCreated} for lead ${resolvedLeadId}, revenue=${revenue}`);
        }
      } catch (commErr) {
        // Log but don't fail the disposition save
        console.error("Commission generation error (non-fatal):", commErr);
      }
    }

    return new Response(JSON.stringify({ success: true, callId: targetCall.id, commissionsCreated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("save-call-disposition error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
