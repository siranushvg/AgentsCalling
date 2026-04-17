import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MapPin, Globe, Clock, AlertTriangle, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfilePreviewProps {
  lead: {
    id: string;
    username: string;
    phone_number?: string;
    email?: string;
    state?: string;
    language?: string;
    status?: string;
    temperature?: string;
    score?: number;
    potential_commission?: number;
    source?: string;
    campaign_id?: string;
    total_call_attempts?: number;
    last_called_at?: string;
    suppressed?: boolean;
    call_priority?: number;
    created_at?: string;
  };
  callHistory?: Array<{
    id: string;
    outcome: string;
    duration: number;
    agent_name?: string;
    created_at: string;
  }>;
  showWarnings?: boolean;
  compact?: boolean;
}

export function UserProfilePreview({ lead, callHistory = [], showWarnings = true, compact = false }: UserProfilePreviewProps) {
  const recentCall = callHistory[0];
  const wasRecentlyContacted = recentCall && (Date.now() - new Date(recentCall.created_at).getTime()) < 2 * 60 * 60 * 1000;

  return (
    <div className={cn('space-y-3', compact ? 'text-xs' : '')}>
      {/* Warnings */}
      {showWarnings && wasRecentlyContacted && (
        <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="text-warning font-medium">Recently contacted {Math.round((Date.now() - new Date(recentCall.created_at).getTime()) / 60000)} min ago</span>
        </div>
      )}

      {lead.suppressed && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive font-medium">Suppressed: {lead.suppressed}</span>
        </div>
      )}

      {/* Profile */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">{lead.username}</h4>
          <div className="flex gap-1">
            {lead.temperature && (
              <Badge variant="outline" className={cn(
                'text-[10px]',
                lead.temperature === 'hot' ? 'border-hot text-hot' :
                lead.temperature === 'warm' ? 'border-warm text-warm' : 'border-cool text-cool'
              )}>
                {lead.temperature}
              </Badge>
            )}
            {lead.call_priority && lead.call_priority > 70 && (
              <Badge variant="outline" className="text-[10px] border-warning text-warning">VIP</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lead.state && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.state}</span>
          )}
          {lead.language && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {lead.language}</span>
          )}
          {lead.source && (
            <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {lead.source}</span>
          )}
          {lead.score != null && (
            <span className="flex items-center gap-1">Score: {lead.score}</span>
          )}
        </div>

        {lead.total_call_attempts != null && lead.total_call_attempts > 0 && (
          <p className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            {lead.total_call_attempts} previous attempt{lead.total_call_attempts > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Call History */}
      {callHistory.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Calls</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {callHistory.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{c.outcome || 'N/A'}</Badge>
                  <span className="text-muted-foreground">{c.agent_name || 'Agent'}</span>
                </div>
                <span className="text-muted-foreground">
                  {Math.floor(c.duration / 60)}:{(c.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
