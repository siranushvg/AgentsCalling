import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token, x-webhook-secret",
};

interface FtdEvent {
  username?: string;
  phone_number?: string;
  deposit_amount?: number;
  deposit_at?: string;
  external_reference?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook credentials
    const token = req.headers.get("x-webhook-token") ?? "";
    const secret = req.headers.get("x-webhook-secret") ?? "";
    const expectedToken = Deno.env.get("WEBHOOK_TOKEN") ?? "";
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";

    if (!expectedToken || !expectedSecret || token !== expectedToken || secret !== expectedSecret) {
      console.warn("receive-ftd-webhook: Invalid credentials");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const events: FtdEvent[] = Array.isArray(body) ? body : [body];

    const results: Array<{ status: string; lead_id?: string; agent_id?: string; error?: string }> = [];

    for (const event of events) {
      const result = await processEvent(adminClient, event);
      results.push(result);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("receive-ftd-webhook error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processEvent(
  adminClient: ReturnType<typeof createClient>,
  event: FtdEvent
): Promise<{ status: string; lead_id?: string; agent_id?: string; error?: string }> {
  const { username, phone_number, deposit_amount, deposit_at, external_reference } = event;

  if (!username && !phone_number) {
    return { status: "skipped", error: "username or phone_number required" };
  }

  // 1. Find lead
  const lead = await findLead(adminClient, username, phone_number);
  if (!lead) {
    return { status: "skipped", error: `No lead found for username=${username}, phone=${phone_number}` };
  }

  // 2. Find responsible agent (last connected call > assigned agent)
  const agentId = await findResponsibleAgent(adminClient, lead);
  if (!agentId) {
    return { status: "skipped", lead_id: lead.id, error: "No agent found for this lead" };
  }

  // 3. Insert FTD event directly as verified — BO is the source of truth
  const { error: insertError } = await adminClient.from("ftd_events").insert({
    lead_id: lead.id,
    agent_id: agentId,
    call_id: lead.last_call_id ?? null,
    phone_number: phone_number ?? null,
    username: username ?? lead.username,
    deposit_amount: deposit_amount ?? 0,
    external_reference: external_reference ?? null,
    source: "webhook",
    verified: true,
    matched_at: deposit_at ? new Date(deposit_at).toISOString() : new Date().toISOString(),
  });

  if (insertError) {
    console.error("FTD insert error:", insertError);
    return { status: "error", lead_id: lead.id, error: insertError.message };
  }

  // 4. Mark call as ftd_verified
  if (lead.last_call_id) {
    await adminClient.from("calls").update({ ftd_verified: true }).eq("id", lead.last_call_id);
  }

  // 5. Update lead status
  await adminClient.from("leads").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", lead.id);

  // 6. Generate commissions
  await generateCommissions(adminClient, lead.id, agentId, deposit_amount ?? 0);

  console.log(`FTD verified: lead=${lead.id}, agent=${agentId}, amount=${deposit_amount}, deposit_at=${deposit_at}`);
  return { status: "success", lead_id: lead.id, agent_id: agentId };
}

async function findLead(
  adminClient: ReturnType<typeof createClient>,
  username?: string,
  phone_number?: string
): Promise<{ id: string; assigned_agent_id: string | null; username: string; last_call_id: string | null } | null> {
  // Try username first (primary match for BO)
  if (username) {
    const { data } = await adminClient
      .from("leads")
      .select("id, assigned_agent_id, username")
      .eq("username", username)
      .limit(1)
      .maybeSingle();
    if (data) {
      const lastCall = await getLastConnectedCall(adminClient, data.id);
      return { ...data, last_call_id: lastCall };
    }
  }

  // Fallback to phone
  if (phone_number) {
    const normalized = phone_number.replace(/[^0-9]/g, "").slice(-10);
    const { data } = await adminClient
      .from("leads")
      .select("id, assigned_agent_id, username")
      .eq("normalized_phone", normalized)
      .limit(1)
      .maybeSingle();
    if (data) {
      const lastCall = await getLastConnectedCall(adminClient, data.id);
      return { ...data, last_call_id: lastCall };
    }
  }

  return null;
}

async function getLastConnectedCall(
  adminClient: ReturnType<typeof createClient>,
  leadId: string
): Promise<string | null> {
  const { data } = await adminClient
    .from("calls")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["completed", "connected"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findResponsibleAgent(
  adminClient: ReturnType<typeof createClient>,
  lead: { id: string; assigned_agent_id: string | null }
): Promise<string | null> {
  // Priority: last agent with connected/completed call > assigned agent
  const { data: lastCall } = await adminClient
    .from("calls")
    .select("agent_id")
    .eq("lead_id", lead.id)
    .in("status", ["completed", "connected"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return lastCall?.agent_id ?? lead.assigned_agent_id;
}

async function generateCommissions(
  adminClient: ReturnType<typeof createClient>,
  leadId: string,
  agentId: string,
  depositAmount: number
): Promise<void> {
  try {
    const { data: agent } = await adminClient
      .from("agents")
      .select("id, referral_code, referred_by")
      .eq("id", agentId)
      .single();

    if (!agent) return;

    const { data: rateRow } = await adminClient
      .from("commission_settings")
      .select("direct_rate, tier2_rate, tier3_rate")
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    const directRate = Number(rateRow?.direct_rate ?? 30);
    const tier2Rate = Number(rateRow?.tier2_rate ?? 5);
    const tier3Rate = Number(rateRow?.tier3_rate ?? 3);
    const revenue = Number(depositAmount);

    // Check if commission already exists for this lead+agent
    const { count } = await adminClient
      .from("commissions")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("agent_id", agent.id)
      .eq("tier", "direct");

    if ((count ?? 0) > 0) return;

    // Direct commission
    const directAmount = (revenue * directRate) / 100;
    if (directAmount > 0) {
      await adminClient.from("commissions").insert({
        agent_id: agent.id, lead_id: leadId, amount: directAmount,
        rate_used: directRate, tier: "direct",
      });
    }

    // Tier 2
    if (agent.referred_by) {
      const { data: t2 } = await adminClient
        .from("agents")
        .select("id, referred_by")
        .eq("referral_code", agent.referred_by)
        .eq("status", "active")
        .maybeSingle();

      if (t2) {
        const t2Amount = (revenue * tier2Rate) / 100;
        if (t2Amount > 0) {
          await adminClient.from("commissions").insert({
            agent_id: t2.id, lead_id: leadId, amount: t2Amount,
            rate_used: tier2Rate, tier: "tier2", tier2_agent_id: agent.id,
          });
        }

        // Tier 3
        if (t2.referred_by) {
          const { data: t3 } = await adminClient
            .from("agents")
            .select("id")
            .eq("referral_code", t2.referred_by)
            .eq("status", "active")
            .maybeSingle();

          if (t3) {
            const t3Amount = (revenue * tier3Rate) / 100;
            if (t3Amount > 0) {
              await adminClient.from("commissions").insert({
                agent_id: t3.id, lead_id: leadId, amount: t3Amount,
                rate_used: tier3Rate, tier: "tier3",
                tier3_agent_id: agent.id, tier2_agent_id: t2.id,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Commission generation error (non-fatal):", err);
  }
}
