import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle, XCircle, Clock, AlertCircle, Plus, FileText, ExternalLink, Trash2, Eye, FileCheck, Download, CalendarIcon, X } from 'lucide-react';
import { downloadOfferLetterPdf } from '@/lib/generateOfferLetterPdf';
import { maskPhone } from '@/lib/maskPhone';
import { exportToCSV } from '@/lib/exportCSV';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OnboardingRow {
  id: string;
  agent_id: string;
  full_name: string;
  fathers_name: string;
  aadhar_number: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  custom_fields: Record<string, string>;
  onboarding_status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  agents?: { full_name: string; email: string; phone: string; city: string; joining_date: string | null; monthly_salary: number };
  offer_letter_confirmed?: boolean;
}

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  display_order: number;
  options: unknown[];
  is_active: boolean;
}

interface DocRecord {
  id: string;
  agent_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Pending Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export default function AdminOnboarding() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<OnboardingRow | null>(null);
  const [reviewDocs, setReviewDocs] = useState<DocRecord[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Custom field modal
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [fieldForm, setFieldForm] = useState({ field_name: '', field_label: '', field_type: 'text', is_required: false, options: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [onbRes, fieldsRes] = await Promise.all([
      supabase.from('agent_onboarding').select('*, agents(full_name, email, phone, city, joining_date, monthly_salary)').order('updated_at', { ascending: false }),
      supabase.from('onboarding_custom_fields').select('*').order('display_order'),
    ]);
    if (onbRes.data) setRows(onbRes.data as unknown as OnboardingRow[]);
    if (fieldsRes.data) setCustomFields(fieldsRes.data as CustomField[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openReview = async (row: OnboardingRow) => {
    setReviewTarget(row);
    setReviewNotes(row.review_notes || '');
    const { data } = await supabase.from('onboarding_documents').select('*').eq('agent_id', row.agent_id);
    setReviewDocs((data || []) as DocRecord[]);
  };

  const handleReviewAction = async (action: 'approved' | 'rejected') => {
    if (!reviewTarget) return;
    setSaving(true);
    const { error } = await supabase.from('agent_onboarding').update({
      onboarding_status: action,
      review_notes: reviewNotes.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: (await supabase.auth.getUser()).data.user?.id,
    }).eq('id', reviewTarget.id);

    if (error) {
      toast.error('Failed to update status.');
    } else {
      // On approval, link referral code to agent profile if provided
      if (action === 'approved' && (reviewTarget as any).referred_by_code?.trim()) {
        await supabase.from('agents').update({
          referred_by: (reviewTarget as any).referred_by_code.trim(),
        }).eq('id', reviewTarget.agent_id);
      }
      toast.success(`Onboarding ${action}.`);
      setReviewTarget(null);
      fetchData();
    }
    setSaving(false);
  };

  const openFieldModal = (field?: CustomField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        field_name: field.field_name,
        field_label: field.field_label,
        field_type: field.field_type,
        is_required: field.is_required,
        options: Array.isArray(field.options) ? field.options.join(', ') : '',
      });
    } else {
      setEditingField(null);
      setFieldForm({ field_name: '', field_label: '', field_type: 'text', is_required: false, options: '' });
    }
    setFieldModalOpen(true);
  };

  const saveField = async () => {
    if (!fieldForm.field_label.trim()) { toast.error('Field label is required.'); return; }
    const fieldName = fieldForm.field_name.trim() || fieldForm.field_label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const payload = {
      field_name: fieldName,
      field_label: fieldForm.field_label.trim(),
      field_type: fieldForm.field_type,
      is_required: fieldForm.is_required,
      options: fieldForm.options ? fieldForm.options.split(',').map(s => s.trim()).filter(Boolean) : [],
    };

    let error;
    if (editingField) {
      ({ error } = await supabase.from('onboarding_custom_fields').update(payload).eq('id', editingField.id));
    } else {
      ({ error } = await supabase.from('onboarding_custom_fields').insert({ ...payload, display_order: customFields.length }));
    }

    if (error) toast.error('Failed to save field: ' + error.message);
    else { toast.success('Field saved.'); setFieldModalOpen(false); fetchData(); }
  };

  const toggleFieldActive = async (field: CustomField) => {
    await supabase.from('onboarding_custom_fields').update({ is_active: !field.is_active }).eq('id', field.id);
    fetchData();
  };

  const deleteField = async (field: CustomField) => {
    await supabase.from('onboarding_custom_fields').delete().eq('id', field.id);
    toast.success('Field deleted.');
    fetchData();
  };

  const downloadDoc = async (doc: DocRecord) => {
    const { data, error } = await supabase.storage.from('onboarding-documents').createSignedUrl(doc.storage_path, 300);
    if (error || !data?.signedUrl) { toast.error('Failed to get download link.'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleExportOnboarding = () => {
    const dataToExport = filteredRows.length > 0 ? filteredRows : rows;
    if (dataToExport.length === 0) { toast.error('No data to export.'); return; }
    const exportData = dataToExport.map(r => ({
      'Agent Name': r.agents?.full_name || r.full_name || '',
      'Email': r.agents?.email || '',
      'Phone': r.agents?.phone ? maskPhone(r.agents.phone) : '',
      'City': r.agents?.city || '',
      'Father\'s Name': r.fathers_name,
      'Aadhaar Number': r.aadhar_number,
      'Bank Account Name': r.bank_account_name,
      'Bank Account Number': r.bank_account_number,
      'Bank IFSC': r.bank_ifsc,
      'Bank Name': r.bank_name,
      'Referral Code': (r as any).referred_by_code || '',
      'Status': r.onboarding_status,
      'Review Notes': r.review_notes || '',
      'Submitted At': r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '',
    }));
    exportToCSV(exportData, 'onboarding-details');
    toast.success('Onboarding details exported.');
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.onboarding_status !== statusFilter) return false;
      const reviewedDate = r.reviewed_at ? new Date(r.reviewed_at) : null;
      const updatedDate = new Date(r.updated_at);
      const checkDate = reviewedDate || updatedDate;
      if (dateFrom && checkDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (checkDate > endOfDay) return false;
      }
      return true;
    });
  }, [rows, statusFilter, dateFrom, dateTo]);

  const pendingCount = rows.filter(r => r.onboarding_status === 'submitted').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Onboarding</h1>
          <p className="text-sm text-muted-foreground">Review submissions and manage onboarding form fields.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-xs">{pendingCount} Pending Review</Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleExportOnboarding}>
            <Download className="h-4 w-4 mr-1.5" /> Export Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Submissions ({rows.length})</TabsTrigger>
          <TabsTrigger value="fields">Custom Fields ({customFields.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs mb-1 block">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal h-9", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setStatusFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
            <div className="ml-auto text-xs text-muted-foreground">
              Showing {filteredRows.length} of {rows.length}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Aadhaar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed At</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No onboarding submissions match filters.</TableCell></TableRow>
                  )}
                  {filteredRows.map(row => {
                    const sb = STATUS_BADGE[row.onboarding_status] || STATUS_BADGE.draft;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.agents?.full_name || '—'}</TableCell>
                        <TableCell>{row.full_name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{row.aadhar_number ? maskPhone(row.aadhar_number) : '—'}</TableCell>
                        <TableCell><Badge variant={sb.variant} className="text-xs">{sb.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.reviewed_at ? new Date(row.reviewed_at).toLocaleDateString() : new Date(row.updated_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openReview(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Fields Tab */}
        <TabsContent value="fields" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openFieldModal()}><Plus className="h-4 w-4 mr-1" /> Add Field</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customFields.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No custom fields defined. Click "Add Field" to create one.</TableCell></TableRow>
                  )}
                  {customFields.map(field => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.field_label}</TableCell>
                      <TableCell className="font-mono text-xs">{field.field_name}</TableCell>
                      <TableCell className="capitalize">{field.field_type}</TableCell>
                      <TableCell>{field.is_required ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <Switch checked={field.is_active} onCheckedChange={() => toggleFieldActive(field)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFieldModal(field)}><FileText className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteField(field)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Detail Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Onboarding — {reviewTarget?.agents?.full_name || reviewTarget?.full_name}</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Full Name:</span> <span className="font-medium ml-1">{reviewTarget.full_name}</span></div>
                <div><span className="text-muted-foreground">Father's Name:</span> <span className="font-medium ml-1">{reviewTarget.fathers_name}</span></div>
                <div><span className="text-muted-foreground">Aadhaar:</span> <span className="font-medium font-mono ml-1">{reviewTarget.aadhar_number}</span></div>
                {(reviewTarget as any).referred_by_code && (
                  <div><span className="text-muted-foreground">Referral Code:</span> <span className="font-medium font-mono ml-1">{(reviewTarget as any).referred_by_code}</span></div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Account Name:</span> <span className="font-medium ml-1">{reviewTarget.bank_account_name}</span></div>
                <div><span className="text-muted-foreground">Account No:</span> <span className="font-medium font-mono ml-1">{reviewTarget.bank_account_number}</span></div>
                <div><span className="text-muted-foreground">IFSC:</span> <span className="font-medium font-mono ml-1">{reviewTarget.bank_ifsc}</span></div>
                <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium ml-1">{reviewTarget.bank_name}</span></div>
              </div>

              {Object.keys(reviewTarget.custom_fields || {}).length > 0 && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {Object.entries(reviewTarget.custom_fields).map(([key, val]) => (
                      <div key={key}><span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span> <span className="font-medium ml-1">{val}</span></div>
                    ))}
                  </div>
                </>
              )}

              {reviewDocs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Documents</p>
                    <div className="space-y-2">
                      {reviewDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{doc.file_name}</span>
                          <span className="text-muted-foreground capitalize text-xs">({doc.document_type.replace(/_/g, ' ')})</span>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => downloadDoc(doc)}>
                            <ExternalLink className="h-3 w-3 mr-1" /> Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="space-y-2">
                <Label>Review Notes</Label>
                <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add notes for the agent (optional)..." rows={3} />
              </div>
            </div>
          )}
          {reviewTarget && (
          <DialogFooter className="gap-2 flex-wrap">
            {reviewTarget.onboarding_status === 'submitted' && (
              <>
                <Button variant="destructive" onClick={() => handleReviewAction('rejected')} disabled={saving}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button onClick={() => handleReviewAction('approved')} disabled={saving}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
              </>
            )}
            {reviewTarget.onboarding_status === 'approved' && (
              <Button variant="outline" onClick={() => {
                const agent = reviewTarget.agents;
                const jd = agent?.joining_date ? new Date(agent.joining_date) : null;
                const joiningDateStr = jd ? jd.toLocaleDateString('en-IN') : 'TBD';
                const docDate = jd ? new Date(jd.getTime() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
                downloadOfferLetterPdf({
                  fullName: reviewTarget.full_name || agent?.full_name || '',
                  city: agent?.city || '',
                  state: '',
                  joiningDate: joiningDateStr,
                  monthlySalary: agent?.monthly_salary || 0,
                  todayDate: docDate,
                });
              }}>
                <Eye className="h-4 w-4 mr-1" /> Preview Offer Letter
              </Button>
            )}
            {reviewTarget.onboarding_status === 'approved' && !(reviewTarget as any).offer_letter_confirmed && (
              <Button onClick={async () => {
                setSaving(true);
                const { error } = await supabase.from('agent_onboarding').update({
                  offer_letter_confirmed: true,
                  offer_letter_confirmed_at: new Date().toISOString(),
                } as any).eq('id', reviewTarget.id);
                if (error) toast.error('Failed to confirm offer letter.');
                else { toast.success('Offer letter confirmed — agent can now view & download it.'); setReviewTarget(null); fetchData(); }
                setSaving(false);
              }} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                <FileCheck className="h-4 w-4 mr-1" /> Confirm Offer Letter
              </Button>
            )}
          </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Field Modal */}
      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Field Label</Label>
              <Input value={fieldForm.field_label} onChange={e => setFieldForm(p => ({ ...p, field_label: e.target.value }))} placeholder="e.g. PAN Number" />
            </div>
            {!editingField && (
              <div className="space-y-1.5">
                <Label>Field Name (auto-generated if empty)</Label>
                <Input value={fieldForm.field_name} onChange={e => setFieldForm(p => ({ ...p, field_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} placeholder="e.g. pan_number" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Field Type</Label>
              <Select value={fieldForm.field_type} onValueChange={v => setFieldForm(p => ({ ...p, field_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fieldForm.field_type === 'select' && (
              <div className="space-y-1.5">
                <Label>Options (comma-separated)</Label>
                <Input value={fieldForm.options} onChange={e => setFieldForm(p => ({ ...p, options: e.target.value }))} placeholder="Option 1, Option 2, Option 3" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={fieldForm.is_required} onCheckedChange={v => setFieldForm(p => ({ ...p, is_required: v }))} />
              <Label>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldModalOpen(false)}>Cancel</Button>
            <Button onClick={saveField}>Save Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
