import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

async function computeMd5(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await stdCrypto.subtle.digest("MD5", data);
  return encodeHex(new Uint8Array(hashBuffer));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LAAFFIC_BASE_URL = "https://api.laaffic.com/v3";

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

const ERROR_CODES: Record<number, string> = {
  0: "Success",
  [-1]: "Authentication error",
  [-2]: "Restricted IP access",
  [-3]: "Sensitive characters in SMS content",
  [-4]: "SMS content is empty",
  [-5]: "SMS content is too long",
  [-6]: "SMS is not a template",
  [-7]: "Phone number exceeds limit",
  [-8]: "Phone number is empty",
  [-9]: "Abnormal phone number",
  [-10]: "Insufficient balance",
  [-13]: "User locked",
  [-16]: "Timestamp expired",
  [-18]: "Port program unusual",
  [-19]: "Confirm SMS pricing with business team",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json();
    const { leadId, content, testMode, testNumber } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "SMS content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (content.length > 1000) {
      return new Response(
        JSON.stringify({ error: "SMS content is too long (max 1000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = supabaseAdmin();

    // ── TEST MODE: Admin-only, direct phone number ──
    if (testMode) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleRow?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Test mode is admin-only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!testNumber || typeof testNumber !== "string") {
        return new Response(
          JSON.stringify({ error: "testNumber is required in test mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await sendTestSms(testNumber, content, userId, admin);
    }

    // ── NORMAL MODE: lead-based ──
    if (!leadId || typeof leadId !== "string") {
      return new Response(
        JSON.stringify({ error: "leadId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent
    const { data: agentRow } = await admin
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!agentRow) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get lead + verify ownership
    const { data: lead } = await admin
      .from("leads")
      .select("id, phone_number, username")
      .eq("id", leadId)
      .eq("assigned_agent_id", agentRow.id)
      .single();

    if (!lead) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleRow?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Lead not found or not assigned to you" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: adminLead } = await admin
        .from("leads")
        .select("id, phone_number, username")
        .eq("id", leadId)
        .single();

      if (!adminLead) {
        return new Response(
          JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return await sendSms(adminLead, agentRow.id, leadId, content, admin);
    }

    return await sendSms(lead, agentRow.id, leadId, content, admin);
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendSms(
  lead: { id: string; phone_number: string; username: string },
  agentId: string,
  leadId: string,
  content: string,
  admin: ReturnType<typeof supabaseAdmin>
) {
  // Normalize phone number
  const rawDigits = lead.phone_number.replace(/\D/g, "");
  let sendNumber = rawDigits;
  if (rawDigits.length === 10) sendNumber = "91" + rawDigits;

  if (!sendNumber || sendNumber.length < 10) {
    return new Response(
      JSON.stringify({ error: "Invalid phone number for this lead" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load Laaffic credentials
  const apiKey = Deno.env.get("LAAFFIC_API_KEY");
  const apiSecret = Deno.env.get("LAAFFIC_API_SECRET");
  const appId = Deno.env.get("LAAFFIC_APP_ID");
  const senderId = Deno.env.get("LAAFFIC_SENDER_ID") || "";

  if (!apiKey || !apiSecret || !appId) {
    console.error("Missing Laaffic credentials");
    return new Response(
      JSON.stringify({ error: "SMS service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Generate signed headers
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = await computeMd5(apiKey + apiSecret + timestamp);

  const smsBody: Record<string, string> = {
    appId,
    numbers: sendNumber,
    content: content.trim(),
    orderId: leadId,
  };
  if (senderId) smsBody.senderId = senderId;

  console.log("Sending SMS to:", sendNumber, "content length:", content.length);

  const laRes = await fetch(`${LAAFFIC_BASE_URL}/sendSms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Sign: sign,
      Timestamp: timestamp,
      "Api-Key": apiKey,
    },
    body: JSON.stringify(smsBody),
  });

  const laData = await laRes.json();
  console.log("Laaffic response:", JSON.stringify(laData));

  const statusNum = Number(laData.status);
  const isSuccess = statusNum === 0;
  const providerReason = isSuccess
    ? "Success"
    : ERROR_CODES[statusNum] || laData.reason || `Unknown error (${laData.status})`;

  const firstMsg = laData.array?.[0];

  // Save to sms_messages table
  await admin.from("sms_messages").insert({
    agent_id: agentId,
    lead_id: leadId,
    phone_number: sendNumber,
    content: content.trim(),
    provider: "laaffic",
    status: isSuccess ? "sent" : "failed",
    provider_message_id: firstMsg?.msgId || null,
    provider_status_code: statusNum,
    provider_reason: providerReason,
    order_id: firstMsg?.orderId || leadId,
    sender_id: senderId || null,
    success_count: laData.success ? Number(laData.success) : isSuccess ? 1 : 0,
    fail_count: laData.fail ? Number(laData.fail) : isSuccess ? 0 : 1,
    raw_response: laData,
    sent_at: isSuccess ? new Date().toISOString() : null,
  });

  if (!isSuccess) {
    return new Response(
      JSON.stringify({
        error: providerReason,
        status: laData.status,
        success: false,
      }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "SMS sent successfully",
      msgId: firstMsg?.msgId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function sendTestSms(
  testNumber: string,
  content: string,
  adminUserId: string,
  admin: ReturnType<typeof supabaseAdmin>
) {
  const rawDigits = testNumber.replace(/\D/g, "");
  let sendNumber = rawDigits;
  if (rawDigits.length === 10) sendNumber = "91" + rawDigits;

  if (!sendNumber || sendNumber.length < 10) {
    return new Response(
      JSON.stringify({ error: "Invalid phone number" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const apiKey = Deno.env.get("LAAFFIC_API_KEY");
  const apiSecret = Deno.env.get("LAAFFIC_API_SECRET");
  const appId = Deno.env.get("LAAFFIC_APP_ID");
  const senderId = Deno.env.get("LAAFFIC_SENDER_ID") || "";

  if (!apiKey || !apiSecret || !appId) {
    return new Response(
      JSON.stringify({ error: "SMS service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = await computeMd5(apiKey + apiSecret + timestamp);

  const smsBody: Record<string, string> = {
    appId,
    numbers: sendNumber,
    content: content.trim(),
    orderId: `test_${Date.now()}`,
  };
  if (senderId) smsBody.senderId = senderId;

  const laRes = await fetch(`${LAAFFIC_BASE_URL}/sendSms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Sign: sign,
      Timestamp: timestamp,
      "Api-Key": apiKey,
    },
    body: JSON.stringify(smsBody),
  });

  const laData = await laRes.json();
  const statusNum = Number(laData.status);
  const isSuccess = statusNum === 0;
  const providerReason = isSuccess
    ? "Success"
    : ERROR_CODES[statusNum] || laData.reason || `Unknown error (${laData.status})`;

  // Log to admin_test_messages
  await admin.from("admin_test_messages").insert({
    admin_id: adminUserId,
    channel: "sms",
    test_number: sendNumber,
    message_content: content.trim(),
    provider: "laaffic",
    provider_status: isSuccess ? "success" : "failed",
    provider_reason: providerReason,
    raw_response: laData,
  });

  if (!isSuccess) {
    return new Response(
      JSON.stringify({ error: providerReason, status: laData.status, success: false }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Test SMS sent successfully", msgId: laData.array?.[0]?.msgId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
