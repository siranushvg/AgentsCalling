import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeLast10 = (phone: string | undefined | null): string => {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '').slice(-10);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VOICELAY_BASE_URL = Deno.env.get('VOICELAY_BASE_URL') || '';
    const VOICELAY_SME_ID = Deno.env.get('VOICELAY_SME_ID') || '';
    const VOICELAY_ACCESS_KEY = Deno.env.get('VOICELAY_ACCESS_KEY') || '';
    const VOICELAY_ACCESS_TOKEN = Deno.env.get('VOICELAY_ACCESS_TOKEN') || '';

    let baseUrl = VOICELAY_BASE_URL.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    // Extract origin
    const urlObj = new URL(baseUrl.includes('/kcrm/') ? baseUrl : `${baseUrl}/kcrm/x`);
    const origin = urlObj.origin;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accesstoken': VOICELAY_ACCESS_TOKEN,
      'accesskey': VOICELAY_ACCESS_KEY,
      'apikey': VOICELAY_ACCESS_KEY,
    };

    // Parse optional date range from request body
    let fromDate = '';
    let toDate = '';
    try {
      const body = await req.json();
      fromDate = body.fromDate || '';
      toDate = body.toDate || '';
    } catch { /* no body */ }

    if (!fromDate) {
      // Default: last 7 days
      const d = new Date();
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().split('T')[0];
    }
    if (!toDate) {
      toDate = new Date().toISOString().split('T')[0];
    }

    // Try multiple CDR endpoints that Voicelay might expose
    const cdrEndpoints = [
      `${origin}/v1/kcrm/getCDR`,
      `${origin}/v1/kcrm/getCallHistory`,
      `${origin}/v1/kcrm/cdr`,
      `${origin}/v1/kcrm/callLogs`,
      `${origin}/v1/kcrm/getCallLogs`,
      `${origin}/v1/kcrm/getCallDetails`,
      `${origin}/v1/kcrm/reports/cdr`,
    ];

    const cdrPayload = {
      smeId: parseInt(VOICELAY_SME_ID),
      fromDate,
      toDate,
      startDate: fromDate,
      endDate: toDate,
      callType: 'all',
      pageSize: 500,
      page: 1,
    };

    console.log('Attempting CDR sync with payload:', JSON.stringify(cdrPayload));

    let cdrData: any = null;
    let successEndpoint = '';

    for (const endpoint of cdrEndpoints) {
      try {
        console.log('Trying CDR endpoint:', endpoint);
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(cdrPayload),
        });

        const text = await resp.text();
        console.log(`CDR response from ${endpoint}: status=${resp.status}, body=${text.slice(0, 500)}`);

        if (resp.ok || resp.status === 200) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.data || parsed.records || parsed.calls || parsed.result || Array.isArray(parsed)) {
              cdrData = parsed;
              successEndpoint = endpoint;
              break;
            }
          } catch { /* not JSON */ }
        }
      } catch (e) {
        console.error(`CDR endpoint ${endpoint} failed:`, e);
      }
    }

    // Also try GET variants
    if (!cdrData) {
      const getEndpoints = [
        `${origin}/v1/kcrm/getCDR?smeId=${VOICELAY_SME_ID}&fromDate=${fromDate}&toDate=${toDate}`,
        `${origin}/v1/kcrm/getCallHistory?smeId=${VOICELAY_SME_ID}&fromDate=${fromDate}&toDate=${toDate}`,
      ];

      for (const endpoint of getEndpoints) {
        try {
          console.log('Trying GET CDR endpoint:', endpoint);
          const resp = await fetch(endpoint, { method: 'GET', headers });
          const text = await resp.text();
          console.log(`GET CDR response: status=${resp.status}, body=${text.slice(0, 500)}`);
          
          if (resp.ok) {
            try {
              const parsed = JSON.parse(text);
              if (parsed.data || parsed.records || parsed.calls || parsed.result || Array.isArray(parsed)) {
                cdrData = parsed;
                successEndpoint = endpoint;
                break;
              }
            } catch { /* not JSON */ }
          }
        } catch (e) {
          console.error(`GET CDR endpoint failed:`, e);
        }
      }
    }

    if (!cdrData) {
      return new Response(JSON.stringify({
        status: 'no_cdr_endpoint',
        message: 'Could not find a working Voicelay CDR endpoint. Tried multiple URL patterns.',
        tried: cdrEndpoints.length + 2,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the CDR data to find inbound calls
    const records = cdrData.data || cdrData.records || cdrData.calls || cdrData.result || (Array.isArray(cdrData) ? cdrData : []);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let synced = 0;
    let skipped = 0;
    const inboundCalls: any[] = [];

    for (const record of records) {
      const callType = String(record.call_type || record.callType || record.type || record.direction || '').toLowerCase();
      const isInbound = callType.includes('incoming') || callType.includes('inbound') || callType === 'in';

      if (!isInbound) continue;

      const callerNumber = record.caller_number || record.callerNumber || record.from || record.customer_number || record.customerNumber || '';
      const calledNumber = record.called_number || record.calledNumber || record.to || record.agent_number || record.agentNumber || '';
      const sessionId = record.session_id || record.sessionId || record.call_id || record.callId || record.id || '';
      const duration = Number(record.duration || record.connected_duration || record.connectedDuration || 0);
      const startTime = record.start_date_time || record.startDateTime || record.start_time || record.startTime || record.created_at || '';
      const endTime = record.end_date_time || record.endDateTime || record.end_time || record.endTime || '';
      const recordingUrl = record.recording_url || record.recordingUrl || record.recording_path || record.recordingPath || null;
      const status = record.overall_call_status || record.overallCallStatus || record.status || '';

      const last10Caller = normalizeLast10(callerNumber);
      if (!last10Caller) continue;

      // Check if already synced
      if (sessionId) {
        const { data: existing } = await supabase
          .from('calls')
          .select('id')
          .eq('session_id', String(sessionId))
          .limit(1)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }
      }

      // Match lead
      const { data: lead } = await supabase
        .from('leads')
        .select('id, assigned_agent_id')
        .eq('normalized_phone', last10Caller)
        .limit(1)
        .maybeSingle();

      // Match agent by voicelay number
      const last10Called = normalizeLast10(calledNumber);
      let agentId = lead?.assigned_agent_id || null;

      if (!agentId && last10Called) {
        const { data: agentMatch } = await supabase
          .from('agents')
          .select('id')
          .or(`voicelay_contact_number.ilike.%${last10Called},voicelay_virtual_number.ilike.%${last10Called}`)
          .limit(1)
          .maybeSingle();

        agentId = agentMatch?.id || null;
      }

      if (!agentId || !lead?.id) {
        console.warn(`Inbound call skipped — no agent/lead match. caller: ${last10Caller}, called: ${last10Called}`);
        skipped++;
        continue;
      }

      const callStatus = duration > 0 ? 'completed' : 'missed';

      const { error: insertErr } = await supabase.from('calls').insert({
        agent_id: agentId,
        lead_id: lead.id,
        call_mode: 'inbound',
        session_id: sessionId ? String(sessionId) : null,
        status: callStatus,
        duration_seconds: duration,
        started_at: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        ended_at: endTime ? new Date(endTime).toISOString() : (startTime ? new Date(new Date(startTime).getTime() + duration * 1000).toISOString() : new Date().toISOString()),
        recording_url: recordingUrl,
        synced_from_voicelay_at: new Date().toISOString(),
        provider_payload: record,
      });

      if (insertErr) {
        console.error('Failed to insert inbound call:', insertErr);
        skipped++;
      } else {
        synced++;
        inboundCalls.push({
          caller: last10Caller,
          agent_id: agentId,
          lead_id: lead.id,
          duration,
          status: callStatus,
        });
      }
    }

    return new Response(JSON.stringify({
      status: 'ok',
      endpoint: successEndpoint,
      totalRecords: records.length,
      inboundSynced: synced,
      skipped,
      inboundCalls,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('sync-voicelay-cdr error:', error);
    return new Response(JSON.stringify({ status: 'error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
