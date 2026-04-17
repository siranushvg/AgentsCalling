import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Check, X, Clock, Bell } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface EarlyLoginRequest {
  id: string;
  agent_id: string;
  shift_date: string;
  shift_start_time: string;
  requested_at: string;
  status: string;
  review_note: string | null;
  agent?: { full_name: string; email: string };
}

export function EarlyLoginRequests() {
  const [requests, setRequests] = useState<EarlyLoginRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('early_login_requests')
      .select('*, agent:agents(full_name, email)')
      .order('requested_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setRequests(data as unknown as EarlyLoginRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    // Realtime subscription
    const channel = supabase
      .channel('admin-early-login')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'early_login_requests',
      }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (requestId: string, status: 'approved' | 'rejected') => {
    setActionLoading(requestId);
    const { error } = await supabase
      .from('early_login_requests')
      .update({
        status,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote[requestId] || null,
      })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed to update: ' + error.message);
    } else {
      toast.success(`Request ${status}`);
      fetchRequests();
    }
    setActionLoading(null);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const recentRequests = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              Pending Early Login Requests
              <Badge variant="secondary" className="ml-auto">{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{req.agent?.full_name || 'Unknown Agent'}</p>
                    <p className="text-xs text-muted-foreground">{req.agent?.email}</p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <Clock className="h-3 w-3 mr-1" /> Pending
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>Shift: {req.shift_start_time?.substring(0, 5)} IST</span>
                  <span>Date: {req.shift_date}</span>
                  <span>Requested: {new Date(req.requested_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <Textarea
                  placeholder="Optional note..."
                  className="text-xs h-16"
                  value={reviewNote[req.id] || ''}
                  onChange={e => setReviewNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={actionLoading === req.id}
                    onClick={() => handleAction(req.id, 'approved')}
                  >
                    <Check className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={actionLoading === req.id}
                    onClick={() => handleAction(req.id, 'rejected')}
                  >
                    <X className="h-3 w-3 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Early Login History</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No early login requests yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRequests.slice(0, 20).map(req => (
                <div key={req.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{req.agent?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.shift_date} · Shift {req.shift_start_time?.substring(0, 5)}
                    </p>
                  </div>
                  <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>
                    {req.status === 'approved' ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
