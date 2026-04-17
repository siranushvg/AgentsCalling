import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_TOKEN = Deno.env.get("WEBHOOK_TOKEN");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function buildPhoneVariants(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  const last10 = normalizePhone(value);

  return Array.from(new Set([
    raw,
    digits,
    last10,
    last10 ? `91${last10}` : "",
    last10 ? `+91${last10}` : "",
  ].filter(Boolean)));
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function getNestedValue(source: unknown, path: string[]) {
  return path.reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function extractDirection(payload: any): "incoming" | "outgoing" | null {
  const owner = payload?.owner ?? payload?.isOwner ?? getNestedValue(payload, ["message", "owner"]);
  if (typeof owner === "boolean") {
    return owner ? "outgoing" : "incoming";
  }

  const eventType = (pickString(payload?.eventType, payload?.event, payload?.eventName, payload?.type) ?? "").toLowerCase();
  if (eventType.includes("sent") || eventType.includes("outgoing")) return "outgoing";
  if (eventType.includes("receive") || eventType.includes("incoming") || eventType.includes("reply")) return "incoming";
  return null;
}

function extractMessageText(payload: any) {
  return pickString(
    payload?.text,
    payload?.finalText,
    payload?.messageText,
    payload?.message,
    getNestedValue(payload, ["message", "text"]),
    typeof payload?.data === "string" ? payload.data : null,
  ) ?? "";
}

function extractCreatedAt(payload: any) {
  return pickString(
    payload?.created,
    payload?.createdAt,
    payload?.timestamp,
    payload?.time,
    payload?.eventTime,
    getNestedValue(payload, ["message", "created"]),
  ) ?? new Date().toISOString();
}

function extractStatus(payload: any) {
  return pickString(payload?.statusString, payload?.status, payload?.messageStatus, payload?.statusType) ?? "delivered";
}

function extractPhone(payload: any) {
  const candidates = [
    payload?.waId,
    payload?.wa_id,
    payload?.whatsappNumber,
    payload?.whatsapp_number,
    payload?.phone,
    payload?.phoneNumber,
    payload?.mobileNumber,
    getNestedValue(payload, ["sender", "phone"]),
    getNestedValue(payload, ["sender", "waId"]),
    getNestedValue(payload, ["contact", "phone"]),
    getNestedValue(payload, ["contact", "waId"]),
    getNestedValue(payload, ["message", "waId"]),
  ];

  for (const candidate of candidates) {
    const value = pickString(candidate);
    if (value) return value;
  }

  return null;
}

function buildSyntheticMessageId(phone: string, payload: any) {
  const raw = [
    normalizePhone(phone),
    extractDirection(payload) ?? "incoming",
    extractCreatedAt(payload),
    extractMessageText(payload),
  ].join("|");

  return `synthetic:${btoa(raw).replace(/=+$/g, "")}`;
}

function extractProviderMessageId(payload: any, phone: string) {
  return pickString(
    payload?.id,
    payload?.messageId,
    payload?.message_id,
    payload?.whatsappMessageId,
    payload?.localMessageId,
    getNestedValue(payload, ["message", "id"]),
  ) ?? buildSyntheticMessageId(phone, payload);
}

async function findConversationByPhone(admin: any, phone: string, leadId?: string) {
  if (leadId) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id, lead_id, phone_number")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const variants = buildPhoneVariants(phone);
  const { data } = await admin
    .from("whatsapp_conversations")
    .select("id, lead_id, phone_number")
    .in("phone_number", variants)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function findLeadByPhone(admin: any, phone: string) {
  const variants = buildPhoneVariants(phone);
  const { data } = await admin
    .from("leads")
    .select("id, phone_number, username")
    .in("phone_number", variants)
    .limit(1)
    .maybeSingle();

  return data;
}

async function ensureConversation(admin: any, phone: string, payload: any) {
  const matchedLead = await findLeadByPhone(admin, phone);
  const resolvedLeadId = matchedLead?.id ?? null;
  const resolvedPhone = matchedLead?.phone_number || phone;
  const displayName = pickString(
    payload?.contactName,
    payload?.senderName,
    payload?.profileName,
    getNestedValue(payload, ["contact", "name"]),
    matchedLead?.username,
    resolvedPhone,
  ) ?? resolvedPhone;
  const lastMessageText = extractMessageText(payload);
  const lastMessageAt = extractCreatedAt(payload);
  const now = new Date().toISOString();

  let conversation = await findConversationByPhone(admin, resolvedPhone, resolvedLeadId ?? undefined);
  if (!conversation) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .insert({
        phone_number: resolvedPhone,
        wa_id: resolvedPhone,
        display_name: displayName,
        lead_id: resolvedLeadId,
        last_message_text: lastMessageText,
        last_message_at: lastMessageAt,
        last_synced_at: now,
      })
      .select("id, lead_id, phone_number")
      .single();
    return data;
  }

  await admin
    .from("whatsapp_conversations")
    .update({
      lead_id: conversation.lead_id ?? resolvedLeadId,
      last_message_text: lastMessageText,
      last_message_at: lastMessageAt,
      last_synced_at: now,
      updated_at: now,
    })
    .eq("id", conversation.id);

  return { ...conversation, lead_id: conversation.lead_id ?? resolvedLeadId };
}

async function persistIncomingMessage(admin: any, phone: string, payload: any) {
  const conversation = await ensureConversation(admin, phone, payload);
  if (!conversation) return { synced: false, reason: "conversation_not_found" };

  const providerMessageId = extractProviderMessageId(payload, phone);
  const { data: existing } = await admin
    .from("whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!existing) {
    const createdAt = extractCreatedAt(payload);
    await admin.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      lead_id: conversation.lead_id,
      direction: "incoming",
      message_text: extractMessageText(payload),
      status: extractStatus(payload),
      provider: "wati",
      provider_message_id: providerMessageId,
      created_at: createdAt,
      sent_at: createdAt,
    });

    const { data: conversationState } = await admin
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversation.id)
      .single();

    await admin
      .from("whatsapp_conversations")
      .update({
        unread_count: (conversationState?.unread_count ?? 0) + 1,
        last_message_text: extractMessageText(payload),
        last_message_at: createdAt,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  return { synced: true, direction: "incoming", conversationId: conversation.id };
}

async function syncOutgoingStatus(admin: any, phone: string, payload: any) {
  const providerMessageId = extractProviderMessageId(payload, phone);
  const status = extractStatus(payload);
  const occurredAt = extractCreatedAt(payload);

  const { data: existing } = await admin
    .from("whatsapp_messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (!existing) {
    const conversation = await ensureConversation(admin, phone, payload);
    if (!conversation) return { synced: false, reason: "conversation_not_found" };

    await admin.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      lead_id: conversation.lead_id,
      direction: "outgoing",
      message_text: extractMessageText(payload),
      status,
      provider: "wati",
      provider_message_id: providerMessageId,
      created_at: occurredAt,
      sent_at: occurredAt,
    });

    return { synced: true, direction: "outgoing", created: true };
  }

  const updates: Record<string, string> = { status };
  if (status.toLowerCase() === "delivered") updates.delivered_at = occurredAt;
  if (status.toLowerCase() === "read") updates.read_at = occurredAt;

  await admin.from("whatsapp_messages").update(updates).eq("id", existing.id);
  return { synced: true, direction: "outgoing", created: false };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const incomingToken = req.headers.get("x-webhook-token") || url.searchParams.get("token");
  const incomingSecret = req.headers.get("x-webhook-secret") || url.searchParams.get("secret");

  const tokenMatches = !WEBHOOK_TOKEN || incomingToken === WEBHOOK_TOKEN;
  const secretMatches = !WEBHOOK_SECRET || incomingSecret === WEBHOOK_SECRET;

  if (!tokenMatches && !secretMatches) {
    return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const phone = extractPhone(payload);
    if (!phone) {
      console.log("wati-webhook ignored payload without phone", JSON.stringify(payload));
      return new Response(JSON.stringify({ received: true, ignored: true, reason: "phone_missing" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = supabaseAdmin();
    const direction = extractDirection(payload);

    if (direction === "incoming") {
      const result = await persistIncomingMessage(admin, phone, payload);
      return new Response(JSON.stringify({ received: true, ...result }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await syncOutgoingStatus(admin, phone, payload);
    return new Response(JSON.stringify({ received: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("wati-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});