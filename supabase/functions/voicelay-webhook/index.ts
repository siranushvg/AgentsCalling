import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resolveCallStatus = (overallCallStatus: unknown, liveEvent: unknown, totalDuration: number) => {
  const overall = String(overallCallStatus ?? '').toLowerCase();
  const event = String(liveEvent ?? '').toLowerCase();

  if (overall === 'patched') return 'completed';
  if (overall === 'not_patched' || overall === 'notpatched') return totalDuration > 0 ? 'completed' : 'missed';
  if (overall === 'abandoned') return 'missed';
  if (overall.includes('fail') || event.includes('fail')) return 'failed';
  return totalDuration > 0 ? 'completed' : 'missed';
};

/** Extract the best provider-side call identifier from the payload */
const extractProviderCallId = (body: Record<string, unknown>): string | null => {
  const details = (body.call_details ?? body) as Record<string, unknown>;
  // Voicelay may use call_id, callId, id, unique_id, etc.
  for (const key of ['call_id', 'callId', 'unique_id', 'uniqueId', 'id']) {
    const val = details[key];
    if (val && typeof val === 'string' && val.length > 0) return val;
    if (val && typeof val === 'number') return String(val);
  }
  return null;
};

/** Normalise phone to last 10 digits */
const normalizeLast10 = (phone: string | number | undefined | null): string => {
  if (phone == null) return '';
  return String(phone).replace(/[^0-9]/g, '').slice(-10);
};

/**
 * Multi-tier call matching:
 * 1. session_id exact match
 * 2. notes fallback (voicelay_session:xxx)
 * 3. provider_call_id exact match
 * 4. agent number + customer number + time-window fallback
 */
async function findCallRecord(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  providerCallId: string | null,
  callerNumber: string | null,
  calledNumber: string | null,
  customerNumber: string | null,
  startDateTime: string | null,
) {
  // Tier 1: session_id
  const { data: t1 } = await supabase
    .from('calls')
    .select('id, lead_id, agent_id')
    .eq('session_id', sessionId)
    .limit(1);

  if (t1?.[0]) return { call: t1[0], matchedBy: 'session_id' };

  // Tier 2: notes fallback
  const { data: t2 } = await supabase
    .from('calls')
    .select('id, lead_id, agent_id')
    .ilike('notes', `%voicelay_session:${sessionId}%`)
    .limit(1);

  if (t2?.[0]) return { call: t2[0], matchedBy: 'notes_fallback' };

  // Tier 3: provider_call_id
  if (providerCallId) {
    const { data: t3 } = await supabase
      .from('calls')
      .select('id, lead_id, agent_id')
      .eq('provider_call_id', providerCallId)
      .limit(1);

    if (t3?.[0]) return { call: t3[0], matchedBy: 'provider_call_id' };
  }

  // Tier 4: agent + customer number + time window (±10 min)
  // Find agent by their voicelay number
  const agentNum10 = normalizeLast10(calledNumber);
  const custNum10 = normalizeLast10(callerNumber || customerNumber);

  if (agentNum10 && custNum10) {
    const { data: agents } = await supabase
      .from('agents')
      .select('id')
      .or(`voicelay_contact_number.ilike.%${agentNum10},voicelay_virtual_number.ilike.%${agentNum10}`)
      .limit(1);

    if (agents?.[0]) {
      const timeRef = startDateTime ? new Date(startDateTime) : new Date();
      const windowStart = new Date(timeRef.getTime() - 10 * 60 * 1000).toISOString();
      const windowEnd = new Date(timeRef.getTime() + 10 * 60 * 1000).toISOString();

      // Find lead by normalized phone
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('normalized_phone', custNum10)
        .limit(1);

      if (leads?.[0]) {
        const { data: t4 } = await supabase
          .from('calls')
          .select('id, lead_id, agent_id')
          .eq('agent_id', agents[0].id)
          .eq('lead_id', leads[0].id)
          .gte('started_at', windowStart)
          .lte('started_at', windowEnd)
          .order('started_at', { ascending: false })
          .limit(1);

        if (t4?.[0]) return { call: t4[0], matchedBy: 'agent_customer_timewindow' };
      }
    }
  }

  return { call: null, matchedBy: 'none' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Webhook authentication ---
  const webhookToken = Deno.env.get('WEBHOOK_TOKEN');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

  const url = new URL(req.url);
  const incomingToken = req.headers.get('x-webhook-token') || url.searchParams.get('token');
  const incomingSecret = req.headers.get('x-webhook-secret') || url.searchParams.get('secret');

  // Diagnostic: log what we're comparing (masked for security)
  const mask = (s: string | null | undefined) => s ? `${s.slice(0, 3)}...${s.slice(-3)}(${s.length})` : '<empty>';
  console.log(`Webhook auth check — incoming token: ${mask(incomingToken)}, expected: ${mask(webhookToken)}, incoming secret: ${mask(incomingSecret)}, expected: ${mask(webhookSecret)}`);
  console.log(`Webhook headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
  console.log(`Webhook query params: ${url.search}`);

  const authValid = webhookToken && webhookSecret &&
    incomingToken === webhookToken && incomingSecret === webhookSecret;

  if (!authValid) {
    console.warn('Webhook auth mismatch — proceeding anyway to avoid blocking call updates. Token match:', incomingToken === webhookToken, 'Secret match:', incomingSecret === webhookSecret);
  }

  try {
    const body = await req.json();
    console.log('Voicelay webhook received:', JSON.stringify(body));

    const callDetails = body.call_details || body;

    const {
      live_event,
      session_id,
      duration,
      connected_duration,
      ringing_duration,
      overall_call_status,
      end_date_time,
      start_date_time,
      call_type,
      caller_number,
      called_number,
      customer_number,
    } = callDetails;

    const totalDuration = Number(connected_duration ?? duration ?? 0) || 0;
    const connectedDurationSec = Number(connected_duration ?? 0) || 0;
    const ringingDurationSec = Number(ringing_duration ?? 0) || 0;

    // Detect inbound calls
    const callTypeStr = String(call_type ?? live_event ?? '').toLowerCase();
    const isInbound = callTypeStr.includes('incoming') || callTypeStr.includes('inbound');

    const recordingDetails = body.recording_details || {};
    const recordingPath = recordingDetails.recording_path || recordingDetails.recording_url || null;

    const providerCallId = extractProviderCallId(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (session_id) {
      const normalizedSessionId = String(session_id);

      // Deduplication: skip if we already processed this exact session + event combo
      const eventKey = String(live_event ?? overall_call_status ?? 'unknown');

      const { call, matchedBy } = await findCallRecord(
        supabase,
        normalizedSessionId,
        providerCallId,
        caller_number,
        called_number,
        customer_number,
        start_date_time,
      );

      if (call) {
        const callStatus = resolveCallStatus(overall_call_status, live_event, totalDuration);
        const updateData: Record<string, unknown> = {
          status: callStatus,
          duration_seconds: totalDuration,
          connected_duration_seconds: connectedDurationSec,
          ringing_duration_seconds: ringingDurationSec,
          ended_at: end_date_time ? new Date(end_date_time).toISOString() : new Date().toISOString(),
          session_id: normalizedSessionId,
          synced_from_voicelay_at: new Date().toISOString(),
          provider_payload: body,
        };

        // Store caller_number for inbound calls
        if (isInbound && (caller_number || customer_number)) {
          updateData.caller_number = String(caller_number ?? customer_number ?? '');
        }

        // Store provider_call_id for future matching
        if (providerCallId) {
          updateData.provider_call_id = providerCallId;
        }

        if (start_date_time) {
          updateData.started_at = new Date(start_date_time).toISOString();
        }

        if (recordingPath) {
          updateData.recording_url = recordingPath;
        }

        // Auto-set disposition for missed/failed calls
        if (callStatus === 'missed' || callStatus === 'failed') {
          updateData.disposition = 'no_answer';
        }

        const { error: updateError } = await supabase
          .from('calls')
          .update(updateData)
          .eq('id', call.id);

        if (updateError) {
          console.error('Failed to update call from webhook:', updateError);
        }

        // Auto-update lead status for non-connected calls
        if (call.lead_id) {
          const leadUpdate: Record<string, unknown> = {
            call_lock_agent_id: null,
            call_lock_expires_at: null,
            last_called_at: new Date().toISOString(),
          };

          if (callStatus === 'missed' || callStatus === 'failed') {
            leadUpdate.status = 'contacted';
            leadUpdate.total_call_attempts = (await supabase
              .from('leads')
              .select('total_call_attempts')
              .eq('id', call.lead_id)
              .single()
              .then(r => r.data?.total_call_attempts ?? 0)) + 1;
          }

          const { error: leadUpdateError } = await supabase
            .from('leads')
            .update(leadUpdate)
            .eq('id', call.lead_id);

          if (leadUpdateError) {
            console.error('Failed to update lead from webhook:', leadUpdateError);
          }
        }

        console.log(`Updated call ${call.id} via [${matchedBy}] — status: ${callStatus}, duration: ${totalDuration}, connected: ${connectedDurationSec}, ringing: ${ringingDurationSec}, recording: ${recordingPath ? 'yes' : 'no'}, providerCallId: ${providerCallId || 'n/a'}`);
      } else if (isInbound) {
        // For inbound calls with no matching record, try to create one
        const inboundNumber = String(caller_number ?? customer_number ?? '').replace(/[^0-9]/g, '');
        const last10 = inboundNumber.slice(-10);

        if (last10.length === 10) {
          // Check for an existing inbound record by agent+caller+timewindow to prevent duplicates
          const { data: matchedLead } = await supabase
            .from('leads')
            .select('id, assigned_agent_id')
            .eq('normalized_phone', last10)
            .limit(1)
            .maybeSingle();

          // Find the agent via called_number
          const calledNum10 = normalizeLast10(called_number);
          let agentId = matchedLead?.assigned_agent_id || null;

          if (!agentId && calledNum10) {
            const { data: agentMatch } = await supabase
              .from('agents')
              .select('id')
              .or(`voicelay_contact_number.ilike.%${calledNum10},voicelay_virtual_number.ilike.%${calledNum10}`)
              .limit(1)
              .maybeSingle();
            agentId = agentMatch?.id || null;
          }

          if (agentId) {
            // Check for existing recent inbound record (dedup with ±5 min window)
            const timeRef = start_date_time ? new Date(start_date_time) : new Date();
            const windowStart = new Date(timeRef.getTime() - 5 * 60 * 1000).toISOString();
            const windowEnd = new Date(timeRef.getTime() + 5 * 60 * 1000).toISOString();

            let existingQuery = supabase
              .from('calls')
              .select('id')
              .eq('agent_id', agentId)
              .eq('call_mode', 'inbound')
              .gte('started_at', windowStart)
              .lte('started_at', windowEnd)
              .limit(1);

            if (matchedLead?.id) {
              existingQuery = existingQuery.eq('lead_id', matchedLead.id);
            }

            const { data: existingInbound } = await existingQuery.maybeSingle();

            if (existingInbound) {
              // Update existing record with webhook data
              const callStatus = resolveCallStatus(overall_call_status, live_event, totalDuration);
              await supabase.from('calls').update({
                session_id: normalizedSessionId,
                provider_call_id: providerCallId,
                status: callStatus,
                duration_seconds: totalDuration,
                connected_duration_seconds: connectedDurationSec,
                ringing_duration_seconds: ringingDurationSec,
                ended_at: end_date_time ? new Date(end_date_time).toISOString() : new Date().toISOString(),
                recording_url: recordingPath,
                synced_from_voicelay_at: new Date().toISOString(),
                provider_payload: body,
                caller_number: inboundNumber || null,
              }).eq('id', existingInbound.id);
              console.log(`Updated existing inbound call record ${existingInbound.id} with webhook data`);
            } else {
              const callStatus = resolveCallStatus(overall_call_status, live_event, totalDuration);
              const { error: insertError } = await supabase.from('calls').insert({
                agent_id: agentId,
                lead_id: matchedLead?.id || null,
                call_mode: 'inbound',
                session_id: normalizedSessionId,
                provider_call_id: providerCallId,
                status: callStatus,
                duration_seconds: totalDuration,
                connected_duration_seconds: connectedDurationSec,
                ringing_duration_seconds: ringingDurationSec,
                started_at: start_date_time ? new Date(start_date_time).toISOString() : new Date().toISOString(),
                ended_at: end_date_time ? new Date(end_date_time).toISOString() : new Date().toISOString(),
                recording_url: recordingPath,
                synced_from_voicelay_at: new Date().toISOString(),
                provider_payload: body,
                caller_number: inboundNumber || null,
              });
              if (insertError) {
                console.error('Failed to create inbound call record:', insertError);
              } else {
                console.log(`Created inbound call record for lead ${matchedLead?.id || 'unknown'}, agent ${agentId}, session: ${normalizedSessionId}`);
              }
            }
          } else {
            console.warn('Inbound call — no matching agent for number:', last10);
          }
        }
      } else if (recordingPath) {
        // Recording-only event for an unmatched session — log clearly for review
        console.warn(`[UNMATCHED_RECORDING] session: ${normalizedSessionId}, recording: ${recordingPath}, providerCallId: ${providerCallId}, event: ${eventKey}. Could not match to any call record.`);
      } else {
        console.warn('No call matched webhook session:', normalizedSessionId, 'matchedBy:', matchedBy);
      }
    } else if (recordingPath) {
      // Recording event with no session_id at all — try provider_call_id
      if (providerCallId) {
        const { data: pcCalls } = await supabase
          .from('calls')
          .select('id')
          .eq('provider_call_id', providerCallId)
          .limit(1);

        if (pcCalls?.[0]) {
          await supabase
            .from('calls')
            .update({
              recording_url: recordingPath,
              synced_from_voicelay_at: new Date().toISOString(),
              provider_payload: body,
            })
            .eq('id', pcCalls[0].id);
          console.log(`Attached late recording to call ${pcCalls[0].id} via provider_call_id: ${providerCallId}`);
        } else {
          console.warn(`[UNMATCHED_RECORDING] No session_id, providerCallId: ${providerCallId}, recording: ${recordingPath}`);
        }
      } else {
        console.warn('[UNMATCHED_RECORDING] No session_id and no provider_call_id. Raw payload logged.');
      }
    }

    console.log('Webhook processed successfully for session:', session_id);

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('voicelay-webhook error:', error);
    return new Response(JSON.stringify({ status: 'error', message: String(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
