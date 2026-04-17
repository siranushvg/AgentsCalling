import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';

const defaultScripts: Record<string, string> = {
  opening: "Hi, am I speaking with {{name}}? This is {{agent}} calling from Arena365. I noticed you recently signed up — I just wanted to welcome you and see if you have any questions about getting started.",
  discovery: "Before I walk you through things — can I ask what caught your attention about Arena365? That way I can focus on what matters most to you.",
  value: "Arena365 gives you access to a wide range of features — and your account is already set up. Most of our active users tell us it only takes a few minutes to get comfortable with Arena365.",
  objection: "I completely understand — no pressure at all. A lot of our users felt the same way initially. If it helps, I can send you a quick summary on WhatsApp so you can review it at your own pace.",
  close: "I'll send you a follow-up message with the details we discussed. If you'd like to continue, it only takes a minute. Otherwise, I'm happy to set up a callback at a time that works for you.",
};

interface CallScriptPanelProps {
  leadName: string;
  agentName?: string;
}

export function CallScriptPanel({ leadName, agentName = 'Rahul' }: CallScriptPanelProps) {
  const [scripts, setScripts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('agent-call-scripts');
    return saved ? JSON.parse(saved) : { ...defaultScripts };
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (key: string) => {
    setEditingKey(key);
    setDraft(scripts[key]);
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const updated = { ...scripts, [editingKey]: draft };
    setScripts(updated);
    localStorage.setItem('agent-call-scripts', JSON.stringify(updated));
    setEditingKey(null);
  };

  const cancelEdit = () => setEditingKey(null);

  const resetScript = (key: string) => {
    const updated = { ...scripts, [key]: defaultScripts[key] };
    setScripts(updated);
    localStorage.setItem('agent-call-scripts', JSON.stringify(updated));
    if (editingKey === key) setEditingKey(null);
  };

  const interpolate = (text: string) =>
    text.replace(/\{\{name\}\}/g, leadName).replace(/\{\{agent\}\}/g, agentName);

  return (
    <div className="w-full max-w-md rounded-lg border bg-muted/50 p-4 space-y-3 text-left">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Script Reference</p>
      {Object.entries(scripts).map(([key, text]) => (
        <div key={key} className="group">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs font-medium text-primary capitalize">{key.replace('_', ' ')}</p>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingKey === key ? (
                <>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={saveEdit}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={cancelEdit}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEdit(key)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {text !== defaultScripts[key] && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => resetScript(key)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {editingKey === key ? (
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="text-xs min-h-[60px] bg-background"
              autoFocus
            />
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">{interpolate(text)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
