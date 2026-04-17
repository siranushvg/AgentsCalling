import React from 'react';
import { Lead } from '@/types';
import { MessageSquare, Phone, AlertTriangle, User, Calendar, FileText } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface HistoryEntry {
  id: string;
  type: 'call' | 'complaint' | 'note' | 'message';
  date: string;
  summary: string;
  agent?: string;
  disposition?: string;
}

export const mockLeadHistory: Record<string, HistoryEntry[]> = {};

export function addHistoryEntry(leadId: string, entry: Omit<HistoryEntry, 'id'>) {
  if (!mockLeadHistory[leadId]) {
    getLeadHistory(leadId); // initialize
  }
  const newEntry: HistoryEntry = { ...entry, id: `${leadId}-${Date.now()}` };
  mockLeadHistory[leadId] = [newEntry, ...mockLeadHistory[leadId]];
}

// Generate mock history for each lead
const complaintTemplates = [
  'Reported delayed withdrawal processing — took 48hrs instead of promised 24hrs',
  'Complained about KYC verification being too slow',
  'Unhappy with bonus terms — felt misled about wagering requirements',
  'App crashes frequently on older Android device',
  'Unable to reach support via chat for 2 days',
  'Disputed a failed transaction that was debited but not credited',
];

const noteTemplates = [
  'Prefers communication in regional language only',
  'High-value user — plays daily, avg deposit ₹2,000',
  'Referred 3 friends already, very engaged with referral program',
  'Price-sensitive — responds well to bonus offers',
  'New user, signed up via Instagram ad campaign',
  'Previously churned, re-engaged through retargeting',
];

const callSummaryTemplates = [
  'Discussed premium features, seemed interested but wants to think',
  'Answered questions about deposit methods, will try UPI',
  'No answer — went to voicemail, left callback message',
  'Explained bonus structure, agreed to make first deposit',
  'Brief call — user was busy, requested callback after 6pm',
  'Resolved app login issue, user satisfied',
];

function getLeadHistory(leadId: string): HistoryEntry[] {
  if (!mockLeadHistory[leadId]) {
    const seed = parseInt(leadId.replace(/\D/g, ''), 10) || 1;
    const entries: HistoryEntry[] = [];
    const agents = ['Rahul S.', 'Priya P.', 'Suresh K.', 'Ananya D.'];

    // Previous calls
    if (seed % 3 !== 0) {
      entries.push({
        id: `${leadId}-c1`,
        type: 'call',
        date: '2026-03-15 14:30',
        summary: callSummaryTemplates[seed % callSummaryTemplates.length],
        agent: agents[seed % agents.length],
        disposition: ['callback', 'interested', 'no_answer'][seed % 3],
      });
    }
    if (seed % 2 === 0) {
      entries.push({
        id: `${leadId}-c2`,
        type: 'call',
        date: '2026-03-12 11:15',
        summary: callSummaryTemplates[(seed + 2) % callSummaryTemplates.length],
        agent: agents[(seed + 1) % agents.length],
        disposition: 'interested',
      });
    }

    // Complaints
    if (seed % 4 < 2) {
      entries.push({
        id: `${leadId}-comp1`,
        type: 'complaint',
        date: '2026-03-14 09:00',
        summary: complaintTemplates[seed % complaintTemplates.length],
      });
    }

    // Notes
    entries.push({
      id: `${leadId}-n1`,
      type: 'note',
      date: '2026-03-10 16:45',
      summary: noteTemplates[seed % noteTemplates.length],
      agent: agents[(seed + 2) % agents.length],
    });

    // Message
    if (seed % 3 === 1) {
      entries.push({
        id: `${leadId}-m1`,
        type: 'message',
        date: '2026-03-13 10:00',
        summary: 'Sent welcome bonus template via WhatsApp — delivered & read',
      });
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    mockLeadHistory[leadId] = entries;
  }
  return mockLeadHistory[leadId];
}

const typeIcons = {
  call: Phone,
  complaint: AlertTriangle,
  note: FileText,
  message: MessageSquare,
};

const typeColors = {
  call: 'text-primary',
  complaint: 'text-destructive',
  note: 'text-muted-foreground',
  message: 'text-success',
};

export function LeadHistoryPanel({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <div className="h-full rounded-lg border bg-card shadow-sm flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a user</p>
      </div>
    );
  }

  const history = getLeadHistory(lead.id);

  const regDate = new Date(lead.created_at);
  const daysSince = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
  const heat = daysSince < 3 ? 'hot' : 'cool';

  return (
    <div className="h-full rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden">
      {/* User Summary */}
      <div className="border-b px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-xs font-mono truncate">{lead.username}</h3>
            <p className="text-[11px] text-muted-foreground">
              Reg: {regDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <StatusBadge variant={heat}>{heat === 'hot' ? '🔥 Hot' : '❄️ Cool'}</StatusBadge>
        </div>
      </div>

      {/* Interaction History */}
      <div className="border-b px-4 py-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History & Notes</h4>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {history.map(entry => {
          const Icon = typeIcons[entry.type];
          return (
            <div key={entry.id} className="rounded-lg border bg-background p-2.5 space-y-1">
              <div className="flex items-start gap-2">
                <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${typeColors[entry.type]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium capitalize">{entry.type}</span>
                    {entry.disposition && (
                      <StatusBadge variant={entry.disposition as React.ComponentProps<typeof StatusBadge>['variant']}>
                        {entry.disposition.replace('_', ' ')}
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{entry.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    {entry.agent && (
                      <span className="text-[10px] text-muted-foreground">by {entry.agent}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No previous interactions</p>
        )}
      </div>
    </div>
  );
}
