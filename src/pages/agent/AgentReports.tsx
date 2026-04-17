import React, { useState, useRef } from 'react';
import { KPICard } from '@/components/KPICard';
import { Phone, Users, Target, MessageSquare, RotateCcw, Loader2, ListChecks, Play, Square, PhoneIncoming, PhoneOutgoing, Filter, Clock } from 'lucide-react';
import { useContactedLeads } from '@/hooks/useContactedLeads';
import { useAgentCallStats } from '@/hooks/useAgentCallStats';
import { useInboundCallLog } from '@/hooks/useInboundCallLog';
import { WhatsAppMessageModal } from '@/components/calling/WhatsAppMessageModal';
import { SmsMessageModal } from '@/components/calling/SmsMessageModal';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { maskPhone } from '@/lib/maskPhone';
import { format } from 'date-fns';

function RecordingPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      title={isPlaying ? 'Stop' : 'Play recording'}
    >
      {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {isPlaying ? 'Stop' : 'Play'}
    </button>
  );
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

export default function AgentReports() {
  const { leads: contactedLeads, isLoading: contactedLoading, addBackToQueue } = useContactedLeads();
  const { stats, isLoading: statsLoading } = useAgentCallStats();
  const { calls: inboundCalls, isLoading: inboundLoading } = useInboundCallLog();
  const [waModal, setWaModal] = useState<{ open: boolean; leadId: string; leadName: string; maskedPhone: string }>({
    open: false, leadId: '', leadName: '', maskedPhone: '',
  });
  const [smsModal, setSmsModal] = useState<{ open: boolean; leadId: string; leadName: string; maskedPhone: string }>({
    open: false, leadId: '', leadName: '', maskedPhone: '',
  });
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [requeueingId, setRequeueingId] = useState<string | null>(null);

  const handleAddToQueue = async (leadId: string) => {
    setRequeueingId(leadId);
    await addBackToQueue(leadId);
    setRequeueingId(null);
  };

  const filteredLeads = directionFilter === 'all'
    ? contactedLeads
    : directionFilter === 'inbound'
      ? contactedLeads.filter(l => l.last_call_mode === 'inbound')
      : contactedLeads.filter(l => l.last_call_mode !== 'inbound' && l.last_call_mode !== null);

  const contactRate = stats.dialsToday > 0 ? ((stats.contactsToday / stats.dialsToday) * 100).toFixed(0) : '0';

  const inboundToday = inboundCalls.filter(c => {
    const today = new Date().toISOString().slice(0, 10);
    return c.started_at.slice(0, 10) === today;
  });

  return (
    <div className="space-y-6">
      {/* Real KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          title="Leads in Queue"
          value={statsLoading ? '…' : stats.totalInQueue}
          icon={<ListChecks className="h-5 w-5" />}
          subtitle={`${stats.totalAssigned} total assigned`}
        />
        <KPICard
          title="Contacted Leads"
          value={statsLoading ? '…' : stats.totalContacted}
          icon={<Users className="h-5 w-5" />}
          subtitle="Moved out of queue"
        />
        <KPICard
          title="Dials Today"
          value={statsLoading ? '…' : stats.dialsToday}
          icon={<Phone className="h-5 w-5" />}
          subtitle={`${contactRate}% contact rate`}
        />
        <KPICard
          title="FTDs Today"
          value={statsLoading ? '…' : stats.convertedToday}
          icon={<Target className="h-5 w-5" />}
          subtitle={`${stats.totalDialsAllTime} all-time dials`}
        />
        <KPICard
          title="Inbound Today"
          value={inboundLoading ? '…' : inboundToday.length}
          icon={<PhoneIncoming className="h-5 w-5" />}
          subtitle={`${inboundCalls.length} total inbound`}
        />
      </div>

      {/* Tabs for Outbound/Inbound logs */}
      <Tabs defaultValue="all-calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-calls" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" /> All Calls
          </TabsTrigger>
          <TabsTrigger value="incoming-calls" className="gap-1.5">
            <PhoneIncoming className="h-3.5 w-3.5" /> Incoming Calls
            {inboundCalls.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{inboundCalls.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All Calls Tab */}
        <TabsContent value="all-calls">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Contacted Leads History</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border p-0.5">
                  {(['all', 'inbound', 'outbound'] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={directionFilter === f ? 'default' : 'ghost'}
                      className="h-7 text-xs capitalize gap-1"
                      onClick={() => setDirectionFilter(f)}
                    >
                      {f === 'inbound' && <PhoneIncoming className="h-3 w-3" />}
                      {f === 'outbound' && <PhoneOutgoing className="h-3 w-3" />}
                      {f === 'all' && <Filter className="h-3 w-3" />}
                      {f}
                    </Button>
                  ))}
                </div>
                <Badge variant="secondary">{filteredLeads.length} leads</Badge>
              </div>
            </div>

            {contactedLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No contacted leads yet. Leads will appear here after you contact them.</p>
            ) : (
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Temperature</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead>Contacted At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead, idx) => (
                      <TableRow key={lead.id}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {lead.last_call_mode === 'inbound'
                              ? <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                              : <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-xs">{lead.last_call_mode === 'inbound' ? 'Inbound' : 'Outbound'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{lead.username}</TableCell>
                        <TableCell className="text-muted-foreground">{maskPhone(lead.phone_number)}</TableCell>
                        <TableCell>{lead.language}</TableCell>
                        <TableCell>{lead.state}</TableCell>
                        <TableCell>
                          {lead.last_disposition ? (
                            <Badge
                              variant={
                                lead.last_disposition === 'converted' ? 'default' :
                                lead.last_disposition === 'interested' ? 'default' :
                                lead.last_disposition === 'callback' ? 'secondary' :
                                lead.last_disposition === 'not_interested' ? 'destructive' :
                                lead.last_disposition === 'no_answer' ? 'outline' :
                                lead.last_disposition === 'wrong_number' ? 'destructive' :
                                lead.last_disposition === 'language_mismatch' ? 'outline' :
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {lead.last_disposition === 'converted' ? 'Committed (FTD)' :
                               lead.last_disposition === 'interested' ? 'Interested' :
                               lead.last_disposition === 'callback' ? 'Callback Scheduled' :
                               lead.last_disposition === 'not_interested' ? 'Not Interested' :
                               lead.last_disposition === 'no_answer' ? 'No Answer' :
                               lead.last_disposition === 'wrong_number' ? 'Wrong Number / Lost' :
                               lead.last_disposition === 'language_mismatch' ? 'Language Mismatch' :
                               lead.last_disposition.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.temperature === 'hot' ? 'destructive' : lead.temperature === 'warm' ? 'default' : 'secondary'} className="text-xs capitalize">
                            {lead.temperature}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {lead.last_recording_url ? (
                            <RecordingPlayer url={lead.last_recording_url} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(lead.updated_at), 'dd MMM, HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs gap-1"
                              onClick={() => setWaModal({ open: true, leadId: lead.id, leadName: lead.username, maskedPhone: maskPhone(lead.phone_number) })}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setSmsModal({ open: true, leadId: lead.id, leadName: lead.username, maskedPhone: maskPhone(lead.phone_number) })}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              SMS
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs gap-1"
                              disabled={requeueingId === lead.id}
                              onClick={() => handleAddToQueue(lead.id)}
                            >
                              {requeueingId === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              Add to Queue
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Incoming Calls Tab */}
        <TabsContent value="incoming-calls">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PhoneIncoming className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Incoming Calls Log</h3>
              </div>
              <Badge variant="secondary">{inboundCalls.length} calls</Badge>
            </div>

            {inboundLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : inboundCalls.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <PhoneIncoming className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No incoming calls recorded yet.</p>
                <p className="text-xs text-muted-foreground">Incoming calls will appear here when detected via the dialer.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboundCalls.map((call, idx) => (
                      <TableRow key={call.id}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{call.lead_username}</TableCell>
                        <TableCell className="text-muted-foreground">{maskPhone(call.lead_phone)}</TableCell>
                        <TableCell>{call.lead_language}</TableCell>
                        <TableCell>{call.lead_state}</TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{call.agent_name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              call.status === 'completed' ? 'default' :
                              call.status === 'missed' ? 'destructive' :
                              call.status === 'failed' ? 'destructive' :
                              call.status === 'connected' ? 'default' :
                              'secondary'
                            }
                            className="text-xs capitalize"
                          >
                            {call.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {call.disposition ? (
                            <Badge
                              variant={
                                call.disposition === 'converted' ? 'default' :
                                call.disposition === 'interested' ? 'default' :
                                call.disposition === 'callback' ? 'secondary' :
                                call.disposition === 'not_interested' ? 'destructive' :
                                call.disposition === 'no_answer' ? 'outline' :
                                call.disposition === 'wrong_number' ? 'destructive' :
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {call.disposition === 'converted' ? 'Committed (FTD)' :
                               call.disposition === 'interested' ? 'Interested' :
                               call.disposition === 'callback' ? 'Callback' :
                               call.disposition === 'not_interested' ? 'Not Interested' :
                               call.disposition === 'no_answer' ? 'No Answer' :
                               call.disposition === 'wrong_number' ? 'Wrong Number' :
                               call.disposition.replace('_', ' ')}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(call.duration_seconds)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {call.recording_url ? (
                            <RecordingPlayer url={call.recording_url} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {call.notes ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px] block" title={call.notes}>
                              {call.notes}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(call.started_at), 'dd MMM, HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs gap-1"
                              onClick={() => setWaModal({ open: true, leadId: call.lead_id, leadName: call.lead_username, maskedPhone: maskPhone(call.lead_phone) })}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setSmsModal({ open: true, leadId: call.lead_id, leadName: call.lead_username, maskedPhone: maskPhone(call.lead_phone) })}
                            >
                              <Phone className="h-3.5 w-3.5" />
                              SMS
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Modal */}
      <WhatsAppMessageModal
        open={waModal.open}
        onClose={() => setWaModal(prev => ({ ...prev, open: false }))}
        leadId={waModal.leadId}
        leadName={waModal.leadName}
        maskedPhone={waModal.maskedPhone}
      />

      {/* SMS Modal */}
      <SmsMessageModal
        open={smsModal.open}
        onClose={() => setSmsModal(prev => ({ ...prev, open: false }))}
        leadId={smsModal.leadId}
        leadName={smsModal.leadName}
        maskedPhone={smsModal.maskedPhone}
      />
    </div>
  );
}
