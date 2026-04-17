import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WATI_API_ENDPOINT = Deno.env.get("WATI_API_ENDPOINT")!;
const WATI_BEARER_TOKEN = Deno.env.get("WATI_BEARER_TOKEN")!;

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Format phone for WATI API: Indian numbers need 91XXXXXXXXXX */
function watiPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("91")) return digits.slice(0, 12);
  // fallback: strip to last 10 and prefix
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `91${last10}` : digits;
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

/** Find a conversation by any phone variant, returns the first match */
async function findConversationByPhone(admin: ReturnType<typeof supabaseAdmin>, phone: string, leadId?: string) {
  // First try by lead_id if available (most reliable)
  if (leadId) {
    const { data } = await admin
      .from("whatsapp_conversations")
      .select("id, lead_id, phone_number")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // Try all phone variants
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

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

type ConversationSummary = {
  id: string;
  lead_id: string | null;
  phone_number: string;
};

type DbHistoryMessage = {
  id: string;
  direction: string;
  message_text: string | null;
  template_name: string | null;
  status: string;
  created_at: string;
  agent_id: string | null;
  provider_message_id: string | null;
};

type NormalizedChatMessage = {
  id: string;
  text: string;
  type: string;
  owner: boolean;
  statusString: string;
  created: string;
  eventType: string;
  data: string | null;
  providerMessageId: string | null;
  source: "provider" | "db";
};

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

type WatiHttpResult = {
  ok: boolean;
  status: number;
  data: any;
  error: string | null;
};

function safeJsonParse(text: string) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function watiRequest(path: string, init: RequestInit = {}): Promise<WatiHttpResult> {
  const url = `${WATI_API_ENDPOINT}${path}`;
  const method = init.method ?? "GET";
  console.log(`WATI ${method}:`, url);

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${WATI_BEARER_TOKEN}`,
        Accept: "application/json",
        ...(init.headers || {}),
      },
    });

    const rawText = await res.text();
    const parsed = safeJsonParse(rawText) ?? {};

    if (!res.ok) {
      console.error(`WATI ${method} failed`, JSON.stringify({ status: res.status, body: rawText.slice(0, 400) }));
    } else if (rawText && Object.keys(parsed).length === 0) {
      console.warn(`WATI ${method} returned non-JSON`, JSON.stringify({ status: res.status, body: rawText.slice(0, 400) }));
    }

    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      error: res.ok
        ? null
        : (typeof parsed?.error === "string" && parsed.error)
          || (typeof parsed?.message === "string" && parsed.message)
          || (typeof parsed?.title === "string" && parsed.title)
          || `WATI request failed with status ${res.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WATI error";
    console.error(`WATI ${method} network error:`, message);
    return { ok: false, status: 0, data: {}, error: message };
  }
}

async function watiGet(path: string) {
  return watiRequest(path);
}

async function watiPost(path: string, body?: unknown) {
  return watiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function isSuccessfulWatiSend(response: WatiHttpResult) {
  const result = response.data?.result;
  const status = (typeof response.data?.status === "string" ? response.data.status : "").toLowerCase();

  const apiOk = response.ok && (
    result === true ||
    result === "success" ||
    response.data?.success === true ||
    status === "success" ||
    status === "sent"
  );

  // WATI may return result:true but validWhatsAppNumber:false — message won't deliver
  if (apiOk && response.data?.validWhatsAppNumber === false) {
    return false;
  }

  return apiOk;
}

function extractMessageText(message: any) {
  return pickString(
    message?.text,
    message?.finalText,
    message?.messageText,
    message?.message,
    getNestedValue(message, ["text"]),
    getNestedValue(message, ["message", "text"]),
    typeof message?.data === "string" ? message.data : null,
  ) ?? "";
}

function extractMessageType(message: any) {
  return pickString(message?.type, message?.messageType, message?.mediaType) ?? "text";
}

function extractMessageCreatedAt(message: any) {
  return pickString(
    message?.created,
    message?.createdAt,
    message?.timestamp,
    message?.time,
    message?.eventTime,
    getNestedValue(message, ["message", "created"]),
  ) ?? new Date().toISOString();
}

function extractMessageStatus(message: any) {
  return pickString(message?.statusString, message?.status, message?.messageStatus, message?.statusType) ?? "sent";
}

function extractDirection(message: any): "incoming" | "outgoing" | null {
  const owner = message?.owner ?? message?.isOwner ?? getNestedValue(message, ["message", "owner"]);
  if (typeof owner === "boolean") {
    return owner ? "outgoing" : "incoming";
  }

  const eventType = (pickString(message?.eventType, message?.event, message?.eventName, message?.type) ?? "").toLowerCase();
  if (eventType.includes("sent") || eventType.includes("outgoing")) return "outgoing";
  if (eventType.includes("receive") || eventType.includes("incoming") || eventType.includes("reply")) return "incoming";
  return null;
}

function buildSyntheticMessageId(phone: string, message: any) {
  const raw = [
    normalizePhone(phone),
    extractDirection(message) ?? "incoming",
    extractMessageCreatedAt(message),
    extractMessageType(message),
    extractMessageText(message),
  ].join("|");

  return `synthetic:${btoa(raw).replace(/=+$/g, "")}`;
}

function extractProviderMessageId(message: any, phone: string) {
  return pickString(
    message?.id,
    message?.messageId,
    message?.message_id,
    message?.whatsappMessageId,
    message?.localMessageId,
    getNestedValue(message, ["message", "id"]),
  ) ?? buildSyntheticMessageId(phone, message);
}

function normalizeProviderMessages(phone: string, items: any[]): NormalizedChatMessage[] {
  return items
    .filter((item) => (pickString(item?.eventType, item?.type) ?? "").toLowerCase() !== "ticketevent")
    .map((item) => {
      const direction = extractDirection(item);
      const providerMessageId = extractProviderMessageId(item, phone);

      return {
        id: providerMessageId,
        text: extractMessageText(item),
        type: extractMessageType(item),
        owner: direction !== "incoming",
        statusString: extractMessageStatus(item),
        created: extractMessageCreatedAt(item),
        eventType: pickString(item?.eventType, item?.event, item?.type) ?? (direction === "incoming" ? "receivedMessage" : "sentMessage"),
        data: pickString(typeof item?.data === "string" ? item.data : null),
        providerMessageId,
        source: "provider",
      };
    });
}

function normalizeDbMessages(items: DbHistoryMessage[]): NormalizedChatMessage[] {
  return items.map((item) => ({
    id: item.id,
    text: item.template_name ? `[Template: ${item.template_name}]` : (item.message_text || ""),
    type: "text",
    owner: item.direction === "outgoing",
    statusString: item.status || "sent",
    created: item.created_at,
    eventType: item.direction === "outgoing" ? "sentMessage" : "receivedMessage",
    data: null,
    providerMessageId: item.provider_message_id,
    source: "db",
  }));
}

function mergeChatMessages(providerMessages: NormalizedChatMessage[], dbMessages: NormalizedChatMessage[]) {
  const merged = new Map<string, NormalizedChatMessage>();

  for (const message of [...dbMessages, ...providerMessages]) {
    const fallbackKey = `${message.owner ? "out" : "in"}|${message.text}|${new Date(message.created).getTime()}`;
    const key = message.providerMessageId || fallbackKey;
    const existing = merged.get(key);

    if (!existing || message.source === "provider") {
      merged.set(key, {
        ...existing,
        ...message,
        text: message.text || existing?.text || "",
        statusString: message.statusString || existing?.statusString || "sent",
      });
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime())
    .map(({ providerMessageId, source, ...message }) => message);
}

async function findLeadByPhone(admin: any, phone: string) {
  const variants = buildPhoneVariants(phone);
  if (variants.length === 0) return null;

  const { data } = await admin
    .from("leads")
    .select("id, phone_number, username")
    .in("phone_number", variants)
    .limit(1)
    .maybeSingle();

  return data;
}

async function ensureConversation(
  admin: any,
  phone: string,
  options: {
    leadId?: string | null;
    displayName?: string | null;
    lastMessageText?: string | null;
    lastMessageAt?: string | null;
  } = {},
): Promise<ConversationSummary | null> {
  const matchedLead = options.leadId ? null : await findLeadByPhone(admin, phone);
  const resolvedLeadId = options.leadId ?? matchedLead?.id ?? null;
  const resolvedPhone = matchedLead?.phone_number || phone;
  const resolvedDisplayName = options.displayName || matchedLead?.username || resolvedPhone;
  const now = new Date().toISOString();

  let conversation = await findConversationByPhone(admin, resolvedPhone, resolvedLeadId ?? undefined);

  if (!conversation) {
    const insertPayload: Record<string, unknown> = {
      phone_number: resolvedPhone,
      wa_id: resolvedPhone,
      display_name: resolvedDisplayName,
      lead_id: resolvedLeadId,
      last_synced_at: now,
    };

    if (options.lastMessageText !== undefined) insertPayload.last_message_text = options.lastMessageText;
    if (options.lastMessageAt !== undefined) insertPayload.last_message_at = options.lastMessageAt;

    const { data } = await admin
      .from("whatsapp_conversations")
      .insert(insertPayload)
      .select("id, lead_id, phone_number")
      .single();

    return data;
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: now,
    last_synced_at: now,
  };

  if (options.lastMessageText !== undefined) updatePayload.last_message_text = options.lastMessageText;
  if (options.lastMessageAt !== undefined) updatePayload.last_message_at = options.lastMessageAt;
  if (!conversation.lead_id && resolvedLeadId) {
    updatePayload.lead_id = resolvedLeadId;
    conversation = { ...conversation, lead_id: resolvedLeadId };
  }

  await admin.from("whatsapp_conversations").update(updatePayload).eq("id", conversation.id);

  return conversation;
}

async function loadDbMessages(admin: any, phone: string, conversationId?: string) {
  const conversationIds = new Set<string>();
  if (conversationId) conversationIds.add(conversationId);

  const phoneVariants = buildPhoneVariants(phone);
  if (phoneVariants.length > 0) {
    const { data: convos } = await admin
      .from("whatsapp_conversations")
      .select("id")
      .in("phone_number", phoneVariants);

    for (const convo of convos || []) {
      conversationIds.add(convo.id);
    }
  }

  if (conversationIds.size === 0) return [] as DbHistoryMessage[];

  const { data } = await admin
    .from("whatsapp_messages")
    .select("id, direction, message_text, template_name, status, created_at, agent_id, provider_message_id")
    .in("conversation_id", Array.from(conversationIds))
    .order("created_at", { ascending: true })
    .limit(200);

  return (data || []) as DbHistoryMessage[];
}

async function persistIncomingMessages(admin: any, conversation: ConversationSummary | null, phone: string, items: any[]) {
  if (!conversation || items.length === 0) return 0;

  const prepared = items
    .map((item) => ({
      conversation_id: conversation.id,
      lead_id: conversation.lead_id,
      direction: "incoming" as const,
      message_text: extractMessageText(item),
      status: extractMessageStatus(item),
      provider_message_id: extractProviderMessageId(item, phone),
      provider: "wati",
      created_at: extractMessageCreatedAt(item),
      sent_at: extractMessageCreatedAt(item),
    }))
    .filter((item) => item.message_text || item.provider_message_id);

  if (prepared.length === 0) return 0;

  const providerIds = Array.from(new Set(prepared.map((item) => item.provider_message_id).filter(Boolean)));
  const { data: existing } = providerIds.length > 0
    ? await admin
        .from("whatsapp_messages")
        .select("provider_message_id")
        .eq("conversation_id", conversation.id)
        .in("provider_message_id", providerIds)
    : { data: [] };

  const existingIds = new Set((existing || []).map((row: any) => row.provider_message_id));
  const newRows = prepared.filter((item) => !item.provider_message_id || !existingIds.has(item.provider_message_id));

  if (newRows.length === 0) {
    await admin
      .from("whatsapp_conversations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", conversation.id);
    return 0;
  }

  const { error } = await admin.from("whatsapp_messages").insert(newRows);
  if (error) {
    console.error("Failed to persist incoming WhatsApp messages:", error.message);
    return 0;
  }

  const latest = newRows[newRows.length - 1];
  const { data: conversationState } = await admin
    .from("whatsapp_conversations")
    .select("unread_count")
    .eq("id", conversation.id)
    .single();

  await admin
    .from("whatsapp_conversations")
    .update({
      last_message_text: latest.message_text,
      last_message_at: latest.created_at,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      unread_count: (conversationState?.unread_count ?? 0) + newRows.length,
    })
    .eq("id", conversation.id);

  return newRows.length;
}

/** Try get_messages from WATI with multiple phone formats until one returns results */
async function watiGetMessagesWithFallback(phone: string): Promise<{ messages: { items: any[] } }> {
  const variants = buildPhoneVariants(phone);
  const tryOrder = Array.from(new Set([
    ...variants.filter(v => v.length === 12 && v.startsWith("91")),
    ...variants.filter(v => v.length === 10),
    ...variants,
  ]));

  for (const variant of tryOrder) {
    try {
      const result = await watiGet(
        `/api/v1/getMessages/${encodeURIComponent(variant)}?pageSize=50&pageNumber=0`
      );
      if (!result.ok) {
        console.log(`WATI getMessages non-ok for variant ${variant}: ${result.status}`);
        continue;
      }
      const payload = result.data ?? {};
      const items = payload?.messages?.items || payload?.messages || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log(`WATI getMessages succeeded with variant: ${variant} (${items.length} msgs)`);
        return { messages: { items } };
      }
    } catch (e) {
      console.log(`WATI getMessages failed for variant ${variant}:`, e);
    }
  }
  return { messages: { items: [] } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth failed:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "get_contacts") {
      const page = url.searchParams.get("page") || "1";
      const result = await watiGet(`/api/v1/getContacts?pageSize=50&pageNumber=${page}`);
      return new Response(JSON.stringify(result.data ?? {}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Agent-scoped contacts: only contacts linked to their assigned leads ──
    if (action === "get_agent_contacts") {
      const admin = supabaseAdmin();

      // Get agent id
      const { data: agentRow } = await admin
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!agentRow) {
        return new Response(JSON.stringify({ contact_list: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get phone numbers of leads assigned to this agent
      const { data: leads } = await admin
        .from("leads")
        .select("id, phone_number, username")
        .eq("assigned_agent_id", agentRow.id)
        .in("status", ["assigned", "contacted", "callback", "converted", "new"]);

      if (!leads || leads.length === 0) {
        return new Response(JSON.stringify({ contact_list: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const leadIds = leads.map((lead) => lead.id);
      const leadById = new Map(leads.map((lead) => [lead.id, lead]));
      const leadPhones = new Set(leads.map((lead) => normalizePhone(lead.phone_number)).filter(Boolean));
      const phoneVariants = Array.from(new Set(leads.flatMap((lead) => buildPhoneVariants(lead.phone_number))));

      const conversationColumns = "id, phone_number, display_name, last_message_text, last_message_at, wa_id, lead_id";

      const [leadConversationResult, agentMessageResult, phoneConversationResult] = await Promise.all([
        admin
          .from("whatsapp_conversations")
          .select(conversationColumns)
          .in("lead_id", leadIds),
        admin
          .from("whatsapp_messages")
          .select("conversation_id")
          .eq("agent_id", agentRow.id),
        phoneVariants.length > 0
          ? admin
              .from("whatsapp_conversations")
              .select(conversationColumns)
              .in("phone_number", phoneVariants)
          : Promise.resolve({ data: [] }),
      ]);

      const agentConversationIds = Array.from(new Set((agentMessageResult.data || []).map((row) => row.conversation_id).filter(Boolean)));
      const agentConversationIdSet = new Set(agentConversationIds);
      const agentConversationResult = agentConversationIds.length > 0
        ? await admin
            .from("whatsapp_conversations")
            .select(conversationColumns)
            .in("id", agentConversationIds)
        : { data: [] };

      const candidateConversationMap = new Map<string, {
        id: string;
        phone_number: string;
        display_name: string | null;
        last_message_text: string | null;
        last_message_at: string | null;
        wa_id: string;
        lead_id: string | null;
      }>();

      // Deduplicate by normalized phone - keep the one with most recent activity
      const seenNormPhones = new Map<string, string>(); // norm -> best conversation id

      for (const conv of [
        ...(leadConversationResult.data || []),
        ...(phoneConversationResult.data || []),
        ...(agentConversationResult.data || []),
      ]) {
        const normalizedPhone = normalizePhone(conv.phone_number);
        const isAssignedLeadConversation = !!conv.lead_id && leadById.has(conv.lead_id);
        const isAssignedPhoneConversation = !!normalizedPhone && leadPhones.has(normalizedPhone);
        const isAgentOwnedConversation = agentConversationIdSet.has(conv.id);

        if (isAssignedLeadConversation || isAssignedPhoneConversation || isAgentOwnedConversation) {
          // Deduplicate: if we already have a conversation for this phone, keep the one with more recent activity
          const existingId = seenNormPhones.get(normalizedPhone);
          if (existingId) {
            const existing = candidateConversationMap.get(existingId);
            if (existing && (conv.last_message_at || '') > (existing.last_message_at || '')) {
              candidateConversationMap.delete(existingId);
              candidateConversationMap.set(conv.id, conv);
              seenNormPhones.set(normalizedPhone, conv.id);
            }
          } else {
            candidateConversationMap.set(conv.id, conv);
            seenNormPhones.set(normalizedPhone, conv.id);
          }
        }
      }

      const candidateConversations = Array.from(candidateConversationMap.values());

      if (candidateConversations.length === 0) {
        return new Response(JSON.stringify({ contact_list: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: candidateMessages } = await admin
        .from("whatsapp_messages")
        .select("conversation_id")
        .in("conversation_id", candidateConversations.map((conv) => conv.id));

      const activeConversationIds = new Set((candidateMessages || []).map((row) => row.conversation_id));

      const contactList = candidateConversations
        .filter((conv) => activeConversationIds.has(conv.id) || !!conv.last_message_at || !!conv.last_message_text)
        .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))
        .map((conv) => ({
          id: conv.id,
          wAid: conv.wa_id || conv.phone_number,
          firstName: conv.display_name || '',
          lastName: '',
          phone: conv.phone_number,
          lastMessage: conv.last_message_text || '',
          lastMessageTime: conv.last_message_at || '',
        }));

      return new Response(JSON.stringify({ contact_list: contactList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_messages") {
      const whatsappNumber = url.searchParams.get("whatsappNumber");
      const conversationId = url.searchParams.get("conversationId");
      if (!whatsappNumber) {
        return new Response(JSON.stringify({ error: "whatsappNumber required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For non-admin users, verify they have access to this phone number
      const admin = supabaseAdmin();
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleRow?.role === 'agent') {
        const { data: agentRow } = await admin
          .from("agents")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (agentRow) {
          let hasAccess = false;

          if (conversationId) {
            const { data: conversation } = await admin
              .from("whatsapp_conversations")
              .select("id, lead_id, phone_number")
              .eq("id", conversationId)
              .single();

            if (conversation?.phone_number) {
              const phoneVariants = buildPhoneVariants(conversation.phone_number);
              const { data: assignedLead } = conversation.lead_id
                ? await admin
                    .from("leads")
                    .select("id")
                    .eq("id", conversation.lead_id)
                    .eq("assigned_agent_id", agentRow.id)
                    .limit(1)
                : { data: [] };

              hasAccess = !!(assignedLead && assignedLead.length > 0);

              if (!hasAccess) {
                const { data: phoneLeadCheck } = await admin
                  .from("leads")
                  .select("id")
                  .eq("assigned_agent_id", agentRow.id)
                  .in("phone_number", phoneVariants)
                  .limit(1);

                hasAccess = !!(phoneLeadCheck && phoneLeadCheck.length > 0);
              }

              if (!hasAccess) {
                const { data: agentMsgCheck } = await admin
                  .from("whatsapp_messages")
                  .select("id")
                  .eq("conversation_id", conversation.id)
                  .eq("agent_id", agentRow.id)
                  .limit(1);
                hasAccess = !!(agentMsgCheck && agentMsgCheck.length > 0);
              }
            }
          } else {
            const phoneVariants = buildPhoneVariants(whatsappNumber);

            const { data: leadCheck } = await admin
              .from("leads")
              .select("id")
              .eq("assigned_agent_id", agentRow.id)
              .in("phone_number", phoneVariants)
              .limit(1);

            hasAccess = !!(leadCheck && leadCheck.length > 0);

            if (!hasAccess) {
              const { data: msgConversations } = await admin
                .from("whatsapp_conversations")
                .select("id")
                .in("phone_number", phoneVariants)
                .limit(20);

              const conversationIds = (msgConversations || []).map((row) => row.id);

              if (conversationIds.length > 0) {
                const { data: agentMsgCheck } = await admin
                  .from("whatsapp_messages")
                  .select("id")
                  .eq("agent_id", agentRow.id)
                  .in("conversation_id", conversationIds)
                  .limit(1);
                hasAccess = !!(agentMsgCheck && agentMsgCheck.length > 0);
              }
            }
          }

          if (!hasAccess) {
            return new Response(JSON.stringify({ error: "Access denied" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Try WATI API with multiple phone format fallbacks
      const data = await watiGetMessagesWithFallback(whatsappNumber);
      const watiItems = data?.messages?.items || data?.messages || [];

      const providerMessages = normalizeProviderMessages(whatsappNumber, watiItems);

      try {
        const adminDb = supabaseAdmin();
        const latestProviderMessage = providerMessages[providerMessages.length - 1];

        let conversation: ConversationSummary | null = null;
        if (conversationId) {
          const { data: existingConversation } = await adminDb
            .from("whatsapp_conversations")
            .select("id, lead_id, phone_number")
            .eq("id", conversationId)
            .maybeSingle();
          conversation = existingConversation;
        }

        if (!conversation) {
          conversation = await ensureConversation(adminDb, whatsappNumber, latestProviderMessage
            ? {
                lastMessageText: latestProviderMessage.text,
                lastMessageAt: latestProviderMessage.created,
              }
            : {});
        }

        const incomingMessages = watiItems.filter((item: any) => extractDirection(item) === "incoming");
        if (conversation) {
          await persistIncomingMessages(adminDb, conversation, whatsappNumber, incomingMessages);
        }

        const dbMessages = normalizeDbMessages(await loadDbMessages(adminDb, whatsappNumber, conversationId || conversation?.id));
        const mergedMessages = mergeChatMessages(providerMessages, dbMessages);

        if (mergedMessages.length > 0) {
          return new Response(JSON.stringify({ messages: { items: mergedMessages }, source: providerMessages.length > 0 ? "merged" : "db" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (syncErr) {
        console.error("Failed to merge WhatsApp history:", syncErr);
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_message") {
      const body = await req.json();
      const { whatsappNumber, message } = body;
      if (!whatsappNumber || !message) {
        return new Response(JSON.stringify({ error: "whatsappNumber and message required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const safePhone = watiPhone(whatsappNumber);
      console.log("WATI send_message normalized phone:", safePhone, "original:", whatsappNumber);
      const sendResult = await watiPost(
        `/api/v1/sendSessionMessage/${encodeURIComponent(safePhone)}?messageText=${encodeURIComponent(message)}`
      );
      const data = sendResult.data ?? {};

      // Persist in DB
      const admin = supabaseAdmin();
      const { data: agentRow } = await admin
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .single();

      const conv = await ensureConversation(admin, whatsappNumber, {
        lastMessageText: message,
        lastMessageAt: new Date().toISOString(),
      });

      const delivered = isSuccessfulWatiSend(sendResult);

      if (conv && agentRow) {
        await admin.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          lead_id: conv.lead_id,
          agent_id: agentRow.id,
          direction: "outgoing",
          message_text: message,
          status: delivered ? "sent" : "failed",
          provider_message_id: pickString(data?.id, data?.messageId, data?.resultData?.id),
          provider: "wati",
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_template") {
      const body = await req.json();
      const { whatsappNumber, templateName, broadcastName, parameters } = body;
      if (!whatsappNumber || !templateName) {
        return new Response(JSON.stringify({ error: "whatsappNumber and templateName required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const safePhone = watiPhone(whatsappNumber);
      console.log("WATI send_template normalized phone:", safePhone, "original:", whatsappNumber);
      const tplResult = await watiPost(`/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(safePhone)}`, {
        template_name: templateName,
        broadcast_name: broadcastName || `agent_${Date.now()}`,
        parameters: parameters || [],
      });
      const data = tplResult.data ?? {};
      const delivered = isSuccessfulWatiSend(tplResult);
      const invalidWa = data?.validWhatsAppNumber === false;

      // Persist
      const admin = supabaseAdmin();
      const { data: agentRow } = await admin.from("agents").select("id").eq("user_id", userId).single();

      const conv = await ensureConversation(admin, whatsappNumber, {
        lastMessageText: `[Template: ${templateName}]`,
        lastMessageAt: new Date().toISOString(),
      });

      if (conv && agentRow) {
        await admin.from("whatsapp_messages").insert({
          conversation_id: conv.id, lead_id: conv.lead_id, agent_id: agentRow.id,
          direction: "outgoing", message_text: `[Template: ${templateName}]`,
          template_name: templateName, status: delivered ? "sent" : "failed",
          provider_message_id: pickString(data?.id, data?.messageId, data?.resultData?.id),
          provider: "wati",
        });
      }

      const responsePayload = { ...data, delivered, ...(invalidWa ? { error: "Number is not a valid WhatsApp number", validWhatsAppNumber: false } : {}) };
      return new Response(JSON.stringify(responsePayload), {
        status: delivered ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_templates") {
      const tplGetResult = await watiGet("/api/v1/getMessageTemplates");
      const data = tplGetResult.data ?? {};
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_media") {
      const filePath = url.searchParams.get("filePath");
      if (!filePath) {
        return new Response(JSON.stringify({ error: "filePath required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Try multiple WATI media URL patterns
      const urls = [
        `${WATI_API_ENDPOINT}/api/v1/getMedia?fileName=${encodeURIComponent(filePath)}`,
        `${WATI_API_ENDPOINT}/${filePath}`,
        `${WATI_API_ENDPOINT}/api/file/${filePath}`,
      ];
      let mediaRes: Response | null = null;
      for (const mediaUrl of urls) {
        console.log("WATI media trying:", mediaUrl);
        const res = await fetch(mediaUrl, {
          headers: { Authorization: `Bearer ${WATI_BEARER_TOKEN}` },
        });
        if (res.ok) {
          mediaRes = res;
          break;
        }
        // Consume body to avoid leak
        await res.text();
      }
      if (!mediaRes || !mediaRes.ok) {
        return new Response(JSON.stringify({ error: "Media fetch failed - all URL patterns tried", status: mediaRes?.status || 404 }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentType = mediaRes.headers.get("content-type") || "application/octet-stream";
      const mediaBody = await mediaRes.arrayBuffer();
      return new Response(mediaBody, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // ── Lead-based actions (phone never sent to frontend) ──

    if (action === "send_message_to_lead") {
      const body = await req.json();
      const { leadId, message: msgText } = body;
      if (!leadId || !msgText) {
        return new Response(JSON.stringify({ error: "leadId and message required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = supabaseAdmin();
      const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("id, phone_number")
        .eq("id", leadId)
        .single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const realPhone = lead.phone_number;
      const safePhone = watiPhone(realPhone);

      console.log("WATI send_message_to_lead phone:", safePhone, "original:", realPhone);
      const sendResult = await watiPost(
        `/api/v1/sendSessionMessage/${encodeURIComponent(safePhone)}?messageText=${encodeURIComponent(msgText)}`
      );
      const data = sendResult.data ?? {};
      console.log("WATI send_message_to_lead response:", JSON.stringify(data));

      // Persist - use variant-aware conversation lookup
      const { data: agentRow } = await admin.from("agents").select("id").eq("user_id", userId).single();

      const conv = await ensureConversation(admin, realPhone, {
        leadId,
        lastMessageText: msgText,
        lastMessageAt: new Date().toISOString(),
      });

      const delivered = isSuccessfulWatiSend(sendResult);
      const invalidWa = data?.validWhatsAppNumber === false;

      if (conv && agentRow) {
        await admin.from("whatsapp_messages").insert({
          conversation_id: conv.id, lead_id: leadId, agent_id: agentRow.id,
          direction: "outgoing", message_text: msgText,
          status: delivered ? "sent" : "failed",
          provider_message_id: pickString(data?.id, data?.messageId, data?.resultData?.id),
          provider: "wati",
        });
      }

      // Return safe response — no real phone
      return new Response(JSON.stringify({ success: delivered, messageId: data?.id || null, ...(invalidWa ? { error: "Number is not a valid WhatsApp number" } : {}) }), {
        status: delivered ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_template_to_lead") {
      const body = await req.json();
      const { leadId, templateName, broadcastName, parameters } = body;
      if (!leadId || !templateName) {
        return new Response(JSON.stringify({ error: "leadId and templateName required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = supabaseAdmin();
      const { data: lead, error: leadErr } = await admin.from("leads").select("id, phone_number").eq("id", leadId).single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const realPhone = lead.phone_number;
      const safePhone = watiPhone(realPhone);

      const tplPayload = {
        template_name: templateName,
        broadcast_name: broadcastName || `agent_${Date.now()}`,
        parameters: parameters || [],
      };
      console.log("WATI send_template_to_lead payload:", JSON.stringify(tplPayload), "phone:", safePhone, "original:", realPhone);
      const tplSendResult = await watiPost(`/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(safePhone)}`, tplPayload);
      const data = tplSendResult.data ?? {};
      console.log("WATI send_template_to_lead response:", JSON.stringify(data));

      const { data: agentRow } = await admin.from("agents").select("id").eq("user_id", userId).single();

      // Use variant-aware lookup
      const conv = await ensureConversation(admin, realPhone, {
        leadId,
        lastMessageText: `[Template: ${templateName}]`,
        lastMessageAt: new Date().toISOString(),
      });

      const delivered = isSuccessfulWatiSend(tplSendResult);
      const invalidWa = data?.validWhatsAppNumber === false;

      if (conv && agentRow) {
        await admin.from("whatsapp_messages").insert({
          conversation_id: conv.id, lead_id: leadId, agent_id: agentRow.id,
          direction: "outgoing", message_text: `[Template: ${templateName}]`,
          template_name: templateName, status: delivered ? "sent" : "failed",
          provider_message_id: pickString(data?.id, data?.messageId, data?.resultData?.id),
          provider: "wati",
        });
      }

      return new Response(JSON.stringify({ success: delivered, ...(invalidWa ? { error: "Number is not a valid WhatsApp number" } : {}) }), {
        status: delivered ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_lead_wa_history") {
      const leadId = url.searchParams.get("leadId");
      if (!leadId) {
        return new Response(JSON.stringify({ error: "leadId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = supabaseAdmin();
      const { data: msgs } = await admin
        .from("whatsapp_messages")
        .select("id, direction, message_text, template_name, status, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(30);

      return new Response(JSON.stringify({ messages: msgs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Sanitize error — never leak phone numbers
    const errMsg = String(err).replace(/\d{10,15}/g, '***MASKED***');
    console.error("wati-proxy error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
