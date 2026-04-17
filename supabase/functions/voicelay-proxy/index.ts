import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const normalizeIndianNumber = (input: string | null | undefined): string | null => {
  if (!input) return null;

  const digits = input.replace(/[^0-9]/g, '');
  if (/^91\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  if (/^0\d{10}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^0091\d{10}$/.test(digits)) return digits.slice(2);

  return null;
};

const isAgentNumberProviderError = (message: string) => {
  const msg = message.toLowerCase();
  return msg.includes('agentnumber') || msg.includes('agent number');
};

const isCustomerNumberProviderError = (message: string) => {
  const msg = message.toLowerCase();
  return msg.includes('customernumber') || msg.includes('customer number');
};

const isPilotNumberProviderError = (message: string) => {
  const msg = message.toLowerCase();
  return msg.includes('pilotnumber') || msg.includes('pilot number');
};

const isWebrtcRegistrationError = (message: string) => {
  const msg = message.toLowerCase();
  return msg.includes('webrtc') && msg.includes('register');
};

const providerAgentNumberVariants = (agentNumber: string): string[] => {
  const digits = agentNumber.replace(/[^0-9]/g, '');
  // Voicelay requires numbers starting with 91. Try both 91XXXXXXXXXX and +91XXXXXXXXXX.
  const variants: string[] = [];
  if (/^91\d{10}$/.test(digits)) {
    variants.push(digits, `+${digits}`);
  } else if (/^\d{10}$/.test(digits)) {
    variants.push(`91${digits}`, `+91${digits}`);
  } else {
    variants.push(digits, `+${digits}`);
  }
  return Array.from(new Set(variants));
};

const isInvalidAgentRegistration = (message: string) => {
  const msg = message.toLowerCase();
  return msg === 'invalid agent number' || (msg.includes('invalid') && msg.includes('agent'));
};

const isAgentBusyError = (message: string, statusCode?: number) => {
  const msg = message.toLowerCase();
  return msg.includes('agent is busy') || msg.includes('agent busy') || statusCode === 409;
};

const REGISTRATION_RETRY_DELAYS_MS = [5000, 8000];
const BUSY_RETRY_DELAYS_MS = [5000, 10000, 15000];

const isSoftphoneRegistrationError = (message: string) =>
  isWebrtcRegistrationError(message) || isInvalidAgentRegistration(message);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;

    // ── Request body ─────────────────────────────────────────────────
    const body = await req.json();
    const { customerNumber, leadId, callMode, action, sessionId: hangupSessionId } = body;

    // ── HANGUP action ────────────────────────────────────────────────
    if (action === 'hangup') {
      if (!hangupSessionId) {
        return new Response(JSON.stringify({ error: 'sessionId is required for hangup' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const VOICELAY_BASE_URL = Deno.env.get('VOICELAY_BASE_URL');
      const VOICELAY_SME_ID = Deno.env.get('VOICELAY_SME_ID');
      const VOICELAY_ACCESS_KEY = Deno.env.get('VOICELAY_ACCESS_KEY');
      const VOICELAY_ACCESS_TOKEN = Deno.env.get('VOICELAY_ACCESS_TOKEN');

      if (!VOICELAY_BASE_URL || !VOICELAY_ACCESS_KEY || !VOICELAY_ACCESS_TOKEN) {
        return new Response(JSON.stringify({ error: 'Voicelay config missing' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let baseUrl = VOICELAY_BASE_URL.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Remove any path after the domain for hangup endpoint
      const urlObj = new URL(baseUrl.includes('/kcrm/') ? baseUrl.replace(/\/kcrm\/.*$/, '') : baseUrl);

      // Try common Voicelay hangup endpoints
      const hangupEndpoints = [
        `${urlObj.origin}/v1/kcrm/hangupCall`,
        `${urlObj.origin}/v1/kcrm/disconnectCall`,
        `${urlObj.origin}/v1/kcrm/endCall`,
      ];

      const hangupPayload = {
        smeId: parseInt(VOICELAY_SME_ID || '0'),
        sessionId: hangupSessionId,
      };

      console.log('Attempting Voicelay hangup:', { sessionId: hangupSessionId });

      let hangupSuccess = false;
      for (const endpoint of hangupEndpoints) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'accesstoken': VOICELAY_ACCESS_TOKEN,
              'accesskey': VOICELAY_ACCESS_KEY,
              'apikey': VOICELAY_ACCESS_KEY,
            },
            body: JSON.stringify(hangupPayload),
          });

          const respText = await resp.text();
          let respData: any;
          try { respData = JSON.parse(respText); } catch { respData = { raw: respText.slice(0, 200) }; }

          console.log('Hangup attempt:', { endpoint, status: resp.status, response: respData });

          if (resp.ok || (respData?.statusCode === 200) || (respData?.status === 200)) {
            hangupSuccess = true;
            return new Response(JSON.stringify({ success: true, message: 'Call disconnected', endpoint }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e) {
          console.error('Hangup endpoint failed:', endpoint, e);
        }
      }

      // Even if hangup API failed, return success so frontend can proceed
      console.warn('No hangup endpoint succeeded — call may continue until party hangs up');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Hangup signal sent. Call will end when either party disconnects.',
        warning: 'Direct hangup API not confirmed'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!customerNumber) {
      return new Response(JSON.stringify({ error: 'customerNumber is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Look up agent's Voicelay mapping from DB ─────────────────────
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('id, full_name, voicelay_virtual_number, voicelay_agent_id, voicelay_sso_token, voicelay_contact_number')
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      console.error('Agent lookup failed:', agentError);
      return new Response(JSON.stringify({
        error: 'No agent profile found for this user. Contact admin.',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build agent number candidates (try virtual first, then contact if needed)
    const agentNumberCandidates = [
      normalizeIndianNumber(agent.voicelay_virtual_number),
      normalizeIndianNumber(agent.voicelay_contact_number),
    ].filter((num, idx, arr): num is string => Boolean(num) && arr.indexOf(num) === idx);

    if (agentNumberCandidates.length === 0) {
      console.error('Agent has no Voicelay number:', agent.id);
      return new Response(JSON.stringify({
        error: 'This agent does not have a valid unique Voicelay number configured. Contact admin to set up your Voicelay mapping.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify uniqueness — no other agent should share this number
    const { data: duplicates } = await supabaseAdmin
      .from('agents')
      .select('id')
      .or(`voicelay_contact_number.eq.${agentNumberCandidates[0]},voicelay_virtual_number.eq.${agentNumberCandidates[0]}`)
      .neq('id', agent.id);

    if (duplicates && duplicates.length > 0) {
      console.error('Duplicate Voicelay number detected:', agentNumberCandidates[0]);
      return new Response(JSON.stringify({
        error: 'Voicelay number conflict detected. This number is mapped to multiple agents. Contact admin.',
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Voicelay config from secrets ─────────────────────────────────
    const VOICELAY_BASE_URL = Deno.env.get('VOICELAY_BASE_URL');
    const VOICELAY_SME_ID = Deno.env.get('VOICELAY_SME_ID');
    const VOICELAY_PILOT_NUMBER = Deno.env.get('VOICELAY_PILOT_NUMBER');
    const VOICELAY_ACCESS_KEY = Deno.env.get('VOICELAY_ACCESS_KEY');
    const VOICELAY_ACCESS_TOKEN = Deno.env.get('VOICELAY_ACCESS_TOKEN');

    if (!VOICELAY_BASE_URL) throw new Error('VOICELAY_BASE_URL not configured');
    if (!VOICELAY_SME_ID) throw new Error('VOICELAY_SME_ID not configured');
    if (!VOICELAY_PILOT_NUMBER) throw new Error('VOICELAY_PILOT_NUMBER not configured');
    if (!VOICELAY_ACCESS_KEY) throw new Error('VOICELAY_ACCESS_KEY not configured');
    if (!VOICELAY_ACCESS_TOKEN) throw new Error('VOICELAY_ACCESS_TOKEN not configured');

    // ── Generate unique session ID (16 digits) ───────────────────────
    const sessionId = `${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`.slice(0, 16);

    const formattedCustomer = normalizeIndianNumber(customerNumber);
    const formattedPilot = normalizeIndianNumber(VOICELAY_PILOT_NUMBER);

    if (!formattedCustomer) {
      return new Response(JSON.stringify({ error: 'Invalid customer number. Use a valid Indian mobile number.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!formattedPilot) {
      throw new Error('VOICELAY_PILOT_NUMBER must be a valid Indian number');
    }

    const createPayload = (agentNumber: string, customerNumber: string, pilotNumber: string) => ({
      smeId: parseInt(VOICELAY_SME_ID),
      sessionId,
      customerNumber,
      agentNumber,
      recordingFlag: 1,
      pilotNumber,
    });

    console.log('Initiating Voicelay call:', {
      sessionId,
      agentId: agent.id,
      agentName: agent.full_name,
      leadId: leadId || 'manual',
      callMode: callMode || 'manual',
      agentNumberCandidates: agentNumberCandidates.map((num) => `${num.slice(0, 4)}****${num.slice(-3)}`),
      customerNumber: formattedCustomer.slice(0, 4) + '****' + formattedCustomer.slice(-3),
    });

    // ── Create call record BEFORE calling provider ───────────────────
    const callRecord: Record<string, unknown> = {
      agent_id: agent.id,
      lead_id: leadId || null,
      status: 'ringing',
      call_mode: callMode || 'manual',
      duration_seconds: 0,
      session_id: sessionId,
      notes: `voicelay_session:${sessionId}`,
    };

    // Only insert if we have a valid leadId (required FK)
    let callRecordId: string | null = null;
    if (leadId) {
      const { data: callData, error: callInsertError } = await supabaseAdmin
        .from('calls')
        .insert(callRecord)
        .select('id')
        .single();

      if (callInsertError) {
        console.error('Failed to create call record:', callInsertError);
        // Don't block the call — log and continue
      } else {
        callRecordId = callData?.id || null;
      }
    }

    // ── Call Voicelay API ────────────────────────────────────────────
    let baseUrl = VOICELAY_BASE_URL.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    const voicelayUrl = baseUrl.includes('/kcrm/clickToCallWithLiveStatus')
      ? baseUrl
      : `${baseUrl}/kcrm/clickToCallWithLiveStatus`;

    console.log('Voicelay request target:', {
      voicelayUrl,
      pilotNumber: `${formattedPilot.slice(0, 4)}****${formattedPilot.slice(-3)}`,
    });

    const callVoicelay = async (agentNumber: string) => {
      let lastResult: {
        response: Response;
        responseData: any;
        voicelayMessage: string;
        isVoicelaySuccess: boolean;
        agentNumber: string;
      } | null = null;

      for (const providerAgentNumber of providerAgentNumberVariants(agentNumber)) {
        const requestAttempts = [
          { customerNumber: formattedCustomer, pilotNumber: formattedPilot },
          { customerNumber: `+${formattedCustomer}`, pilotNumber: formattedPilot },
          { customerNumber: `+${formattedCustomer}`, pilotNumber: `+${formattedPilot}` },
        ];

        for (const attempt of requestAttempts) {
          console.log('Calling provider with agentNumber:', `${providerAgentNumber.slice(0, 4)}****${providerAgentNumber.slice(-3)}`);

          const response = await fetch(voicelayUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'accesstoken': VOICELAY_ACCESS_TOKEN,
              'accesskey': VOICELAY_ACCESS_KEY,
              'apikey': VOICELAY_ACCESS_KEY,
            },
            body: JSON.stringify(createPayload(providerAgentNumber, attempt.customerNumber, attempt.pilotNumber)),
          });

          const responseText = await response.text();
          let responseData: any;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            console.error('Voicelay returned non-JSON response:', responseText.slice(0, 300));
            responseData = { status: response.status, message: `Non-JSON response (HTTP ${response.status})` };
          }
          const voicelayStatus = Number(responseData?.status ?? 0);
          const voicelayMessage = String(responseData?.message ?? '');
          const isVoicelaySuccess = response.ok && (voicelayStatus === 200 || voicelayStatus === 202);

          console.log('Provider response:', {
            statusCode: response.status,
            providerStatus: voicelayStatus,
            message: voicelayMessage,
          });

          lastResult = { response, responseData, voicelayMessage, isVoicelaySuccess, agentNumber: providerAgentNumber };

          if (isVoicelaySuccess) {
            break;
          }

          const shouldRetryWithNextRequestVariant =
            isCustomerNumberProviderError(voicelayMessage) || isPilotNumberProviderError(voicelayMessage);

          if (!shouldRetryWithNextRequestVariant) {
            break;
          }
        }

        if (lastResult?.isVoicelaySuccess || (lastResult && !isAgentNumberProviderError(lastResult.voicelayMessage))) {
          break;
        }
      }

      return lastResult!;
    };

    let callResult = await callVoicelay(agentNumberCandidates[0]);

    if (!callResult.isVoicelaySuccess && isAgentNumberProviderError(callResult.voicelayMessage) && agentNumberCandidates.length > 1) {
      console.warn('Primary agent number rejected by provider, retrying with fallback candidate');
      callResult = await callVoicelay(agentNumberCandidates[1]);
    }

    // Softphone registration can lag behind the iframe load event, so retry with backoff before failing.
    if (!callResult.isVoicelaySuccess && isSoftphoneRegistrationError(callResult.voicelayMessage)) {
      for (const delay of REGISTRATION_RETRY_DELAYS_MS) {
        console.warn(`Agent not registered — waiting ${delay}ms and retrying`);
        await new Promise((r) => setTimeout(r, delay));
        callResult = await callVoicelay(agentNumberCandidates[0]);

        if (!callResult.isVoicelaySuccess && isAgentNumberProviderError(callResult.voicelayMessage) && agentNumberCandidates.length > 1) {
          console.warn('Retry attempt rejected primary agent number, retrying fallback candidate');
          callResult = await callVoicelay(agentNumberCandidates[1]);
        }

        if (callResult.isVoicelaySuccess || !isSoftphoneRegistrationError(callResult.voicelayMessage)) {
          break;
        }
      }
    }

    // Agent busy retry — Voicelay returns 409 when the previous call hasn't fully released
    if (!callResult.isVoicelaySuccess && isAgentBusyError(callResult.voicelayMessage, callResult.response.status)) {
      for (const delay of BUSY_RETRY_DELAYS_MS) {
        console.warn(`Agent is busy — waiting ${delay}ms and retrying`);
        await new Promise((r) => setTimeout(r, delay));
        callResult = await callVoicelay(agentNumberCandidates[0]);

        if (!callResult.isVoicelaySuccess && isAgentNumberProviderError(callResult.voicelayMessage) && agentNumberCandidates.length > 1) {
          callResult = await callVoicelay(agentNumberCandidates[1]);
        }

        if (callResult.isVoicelaySuccess || !isAgentBusyError(callResult.voicelayMessage, callResult.response.status)) {
          break;
        }
      }
    }

    const { response, responseData, voicelayMessage, isVoicelaySuccess } = callResult;

    if (!isVoicelaySuccess) {
      console.error('Voicelay API error:', response.status, responseData);

      // Update call record to failed
      if (callRecordId) {
        await supabaseAdmin
          .from('calls')
          .update({ status: 'failed', ended_at: new Date().toISOString(), notes: `voicelay_session:${sessionId} | provider_error: ${voicelayMessage}` })
          .eq('id', callRecordId);
      }

      const agentNumberIssue = isAgentNumberProviderError(voicelayMessage);
      const registrationIssue = isSoftphoneRegistrationError(voicelayMessage);
      const busyIssue = isAgentBusyError(voicelayMessage, response.status);

      return new Response(JSON.stringify({
        error: registrationIssue
          ? 'Agent softphone is offline or not registered. Please refresh the page, wait for the softphone to connect, then retry.'
          : busyIssue
          ? 'Agent is still busy from the previous call. Please wait a few seconds and try again.'
          : agentNumberIssue
          ? 'Agent phone number format rejected by provider. Contact admin to verify your Voicelay number configuration.'
          : `Call failed: ${voicelayMessage || 'Provider rejected the request'}`,
        providerStatus: response.status,
        details: responseData,
        retryable: busyIssue,
      }), {
        status: busyIssue ? 429 : response.status === 429 ? 429 : (agentNumberIssue || registrationIssue) ? 400 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract provider's own call ID from response for stronger recording mapping
    const providerCallId = responseData?.call_id || responseData?.callId || responseData?.unique_id || responseData?.uniqueId || null;
    if (providerCallId && callRecordId) {
      await supabaseAdmin
        .from('calls')
        .update({ provider_call_id: String(providerCallId) })
        .eq('id', callRecordId);
    }

    console.log('Voicelay call initiated successfully:', { sessionId, callRecordId, providerCallId });

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      callRecordId,
      providerCallId,
      agentName: agent.full_name,
      voicelayResponse: responseData,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('voicelay-proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Clean up orphaned call record if one was created before the error
    if (typeof callRecordId !== 'undefined' && callRecordId) {
      try {
        const supabaseCleanup = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabaseCleanup
          .from('calls')
          .update({ status: 'failed', ended_at: new Date().toISOString(), notes: `voicelay_session: proxy_crash | error: ${message}` })
          .eq('id', callRecordId);
        console.log('Cleaned up orphaned call record:', callRecordId);
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned call record:', cleanupErr);
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
