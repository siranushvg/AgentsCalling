import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Template = Tables<'templates'>;
type Channel = 'whatsapp' | 'sms' | 'rcs';

const emptyForm = { name: '', channel: 'whatsapp' as Channel, content: '', active: true };

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load templates');
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openView = (t: Template) => {
    setSelectedTemplate(t);
    setForm({ name: t.name, channel: t.channel, content: t.content, active: t.active });
    setDialogMode('view');
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setSelectedTemplate(t);
    setForm({ name: t.name, channel: t.channel, content: t.content, active: t.active });
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const openCreate = () => {
    setSelectedTemplate(null);
    setForm(emptyForm);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    setSaving(true);

    if (dialogMode === 'create') {
      const { error } = await supabase.from('templates').insert({
        name: form.name,
        channel: form.channel,
        content: form.content,
        active: form.active,
      });
      if (error) toast.error('Failed to create template');
      else toast.success('Template created');
    } else if (dialogMode === 'edit' && selectedTemplate) {
      const { error } = await supabase.from('templates').update({
        name: form.name,
        channel: form.channel,
        content: form.content,
        active: form.active,
      }).eq('id', selectedTemplate.id);
      if (error) toast.error('Failed to update template');
      else toast.success('Template updated');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchTemplates();
  };

  const isReadOnly = dialogMode === 'view';
  const dialogTitle = dialogMode === 'create' ? 'New Template' : dialogMode === 'edit' ? 'Edit Template' : 'Template Details';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Message Templates</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No templates yet. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Channel</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Content</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b hover:bg-accent/30 cursor-pointer" onClick={() => openView(t)}>
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge variant="new">{t.channel.toUpperCase()}</StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{t.content}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge variant={t.active ? 'active' : 'terminated'}>
                      {t.active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => openView(t)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View / Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                readOnly={isReadOnly}
                className={isReadOnly ? 'bg-muted' : ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Channel</Label>
              {isReadOnly ? (
                <Input value={form.channel.toUpperCase()} readOnly className="bg-muted" />
              ) : (
                <Select value={form.channel} onValueChange={(v: Channel) => setForm(f => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="rcs">RCS</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                readOnly={isReadOnly}
                className={`min-h-[120px] ${isReadOnly ? 'bg-muted' : ''}`}
              />
            </div>

            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <DialogFooter>
            {isReadOnly ? (
              <Button variant="outline" onClick={() => { setDialogMode('edit'); }}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
