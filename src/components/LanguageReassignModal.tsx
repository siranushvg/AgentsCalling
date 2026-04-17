import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Bengali', 'Kannada', 'Malayalam'] as const;

interface LanguageReassignModalProps {
  open: boolean;
  leadName: string;
  leadId?: string;
  currentLanguage: string;
  onReassign: (newLanguage: string, reason: string) => void;
  onClose: () => void;
}

interface AvailableAgent {
  id: string;
  full_name: string;
  languages: string[];
  status: string;
}

export function LanguageReassignModal({ open, leadName, leadId, currentLanguage, onReassign, onClose }: LanguageReassignModalProps) {
  const [selectedLang, setSelectedLang] = useState('');
  const [reason, setReason] = useState('');
  const [matchingAgents, setMatchingAgents] = useState<AvailableAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch available agents when language changes
  useEffect(() => {
    if (!open || !selectedLang) {
      setMatchingAgents([]);
      return;
    }

    const fetchAgents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('id, full_name, languages, status')
        .eq('status', 'active')
        .contains('languages', [selectedLang]);

      if (!error && data) {
        setMatchingAgents(data);
      } else {
        setMatchingAgents([]);
      }
      setLoading(false);
    };
    fetchAgents();
  }, [open, selectedLang]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedLang || !leadId) return;
    if (matchingAgents.length === 0) {
      toast.error(`No available agents who speak ${selectedLang}`);
      return;
    }

    setSubmitting(true);
    try {
      // Pick the first available agent
      const targetAgent = matchingAgents[0];

      // Update lead assignment in DB
      const { error } = await supabase
        .from('leads')
        .update({
          assigned_agent_id: targetAgent.id,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) {
        toast.error('Failed to reassign lead');
        console.error('Reassignment error:', error);
        setSubmitting(false);
        return;
      }

      toast.success(`Lead reassigned to ${targetAgent.full_name} (${selectedLang}). You'll earn 25% commission on conversion.`);
      onReassign(selectedLang, reason);
      setSelectedLang('');
      setReason('');
    } catch {
      toast.error('Failed to reassign lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="font-semibold">Language Reassignment</h3>
            <p className="text-sm text-muted-foreground">{leadName} · Current: {currentLanguage}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-info/10 border border-info/20 p-3 space-y-1">
            <p className="text-xs text-info font-medium">Commission Split: 25% to you · 75% to converting agent</p>
            <p className="text-xs text-muted-foreground">If the lead speaks a language you can't support, reassign them to the right agent. You'll still earn 25% of the commission if they convert.</p>
          </div>

          <div className="space-y-2">
            <Label>Select Customer's Actual Language *</Label>
            <select
              value={selectedLang}
              onChange={e => setSelectedLang(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Choose language...</option>
              {LANGUAGES.filter(l => l !== currentLanguage).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">The lead will be routed to an available agent who speaks this language</p>
          </div>

          {/* Show matching agents */}
          {selectedLang && (
            <div className="space-y-1.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking available agents...
                </div>
              ) : matchingAgents.length > 0 ? (
                <div className="rounded-lg bg-success/10 border border-success/20 p-2">
                  <p className="text-xs text-success font-medium">
                    {matchingAgents.length} available agent{matchingAgents.length > 1 ? 's' : ''} found
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Will assign to: {matchingAgents[0].full_name}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2">
                  <p className="text-xs text-destructive font-medium">
                    No active agents available who speak {selectedLang}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Customer responded in Telugu and could not understand Hindi"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLang || matchingAgents.length === 0 || submitting}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reassigning...</>
            ) : (
              <><ArrowRightLeft className="h-4 w-4 mr-2" /> Reassign Lead</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
