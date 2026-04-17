import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, FileText, Trash2, CheckCircle, Clock, XCircle, AlertCircle, Download } from 'lucide-react';
import { downloadOfferLetterPdf } from '@/lib/generateOfferLetterPdf';

interface OnboardingData {
  id?: string;
  full_name: string;
  fathers_name: string;
  aadhar_number: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  custom_fields: Record<string, string>;
  onboarding_status: string;
  review_notes?: string | null;
  referred_by_code: string;
  offer_letter_confirmed?: boolean;
}

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  display_order: number;
  options: string[];
  is_active: boolean;
}

interface DocRecord {
  id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

const INITIAL: OnboardingData = {
  full_name: '', fathers_name: '', aadhar_number: '',
  bank_account_name: '', bank_account_number: '', bank_ifsc: '', bank_name: '',
  custom_fields: {}, onboarding_status: 'draft', referred_by_code: '',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  submitted: { label: 'Submitted — Pending Review', icon: <AlertCircle className="h-3 w-3" />, variant: 'outline' },
  approved: { label: 'Approved', icon: <CheckCircle className="h-3 w-3" />, variant: 'default' },
  rejected: { label: 'Rejected — Please Revise', icon: <XCircle className="h-3 w-3" />, variant: 'destructive' },
};

export default function AgentOnboarding() {
  const { user } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(INITIAL);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [agentProfile, setAgentProfile] = useState<{ full_name: string; city: string; joining_date: string | null; monthly_salary: number } | null>(null);

  const isEditable = data.onboarding_status === 'draft' || data.onboarding_status === 'rejected';

  // Fetch agent ID for current user
  useEffect(() => {
    if (!user) return;
    supabase.rpc('get_agent_id_for_user', { _user_id: user.id }).then(({ data: aid }) => {
      if (aid) setAgentId(aid);
    });
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);

    const [onboardingRes, fieldsRes, docsRes, agentRes] = await Promise.all([
      supabase.from('agent_onboarding').select('*').eq('agent_id', agentId).maybeSingle(),
      supabase.from('onboarding_custom_fields').select('*').eq('is_active', true).order('display_order'),
      supabase.from('onboarding_documents').select('*').eq('agent_id', agentId).order('created_at'),
      supabase.from('agents').select('full_name, city, joining_date, monthly_salary').eq('id', agentId).maybeSingle(),
    ]);

    if (onboardingRes.data) {
      const row = onboardingRes.data as any;
      setData({
        id: row.id,
        full_name: row.full_name || '',
        fathers_name: row.fathers_name || '',
        aadhar_number: row.aadhar_number || '',
        bank_account_name: row.bank_account_name || '',
        bank_account_number: row.bank_account_number || '',
        bank_ifsc: row.bank_ifsc || '',
        bank_name: row.bank_name || '',
        custom_fields: (row.custom_fields as Record<string, string>) || {},
        onboarding_status: row.onboarding_status || 'draft',
        review_notes: row.review_notes,
        referred_by_code: row.referred_by_code || '',
        offer_letter_confirmed: row.offer_letter_confirmed || false,
      });
    }

    if (agentRes.data) setAgentProfile(agentRes.data as any);

    if (fieldsRes.data) {
      setCustomFields(fieldsRes.data.map((f: any) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      })));
    }

    if (docsRes.data) setDocuments(docsRes.data as DocRecord[]);
    setLoading(false);
  }, [agentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChange = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomChange = (fieldName: string, value: string) => {
    setData(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, [fieldName]: value } }));
  };

  const handleSave = async (submit = false) => {
    if (!agentId) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      agent_id: agentId,
      full_name: data.full_name.trim(),
      fathers_name: data.fathers_name.trim(),
      aadhar_number: data.aadhar_number.trim(),
      bank_account_name: data.bank_account_name.trim(),
      bank_account_number: data.bank_account_number.trim(),
      bank_ifsc: data.bank_ifsc.trim(),
      bank_name: data.bank_name.trim(),
      custom_fields: data.custom_fields,
      referred_by_code: data.referred_by_code.trim(),
    };

    if (submit) {
      if (!data.full_name.trim() || !data.fathers_name.trim() || !data.aadhar_number.trim()) {
        toast.error('Please fill all required personal details.');
        setSaving(false);
        return;
      }
      if (!data.bank_account_number.trim() || !data.bank_ifsc.trim() || !data.bank_name.trim() || !data.bank_account_name.trim()) {
        toast.error('Please fill all bank details.');
        setSaving(false);
        return;
      }
      const missingRequired = customFields.filter(f => f.is_required && !data.custom_fields[f.field_name]?.trim());
      if (missingRequired.length > 0) {
        toast.error(`Please fill: ${missingRequired.map(f => f.field_label).join(', ')}`);
        setSaving(false);
        return;
      }
      payload.onboarding_status = 'submitted';
    }

    let error;
    if (data.id) {
      ({ error } = await supabase.from('agent_onboarding').update(payload).eq('id', data.id));
    } else {
      ({ error } = await supabase.from('agent_onboarding').insert(payload as any));
    }

    if (error) {
      console.error('Save error:', error);
      toast.error('Failed to save. Please try again.');
    } else {
      toast.success(submit ? 'Onboarding submitted for review!' : 'Draft saved.');
      fetchData();
    }
    setSaving(false);
  };

  const handleUpload = async (docType: string, file: File) => {
    if (!agentId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10 MB.'); return; }

    setUploading(docType);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${agentId}/${docType}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('onboarding-documents').upload(path, file);
    if (uploadError) { toast.error('Upload failed: ' + uploadError.message); setUploading(null); return; }

    const { error: dbError } = await supabase.from('onboarding_documents').insert({
      agent_id: agentId, document_type: docType, storage_path: path, file_name: file.name, file_size: file.size,
    });
    if (dbError) { toast.error('Failed to save document record.'); }
    else { toast.success('Document uploaded.'); fetchData(); }
    setUploading(null);
  };

  const handleDeleteDoc = async (doc: DocRecord) => {
    await supabase.storage.from('onboarding-documents').remove([doc.storage_path]);
    await supabase.from('onboarding_documents').delete().eq('id', doc.id);
    toast.success('Document removed.');
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[data.onboarding_status] || STATUS_CONFIG.draft;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete your profile details and upload required documents.</p>
        </div>
        <Badge variant={statusCfg.variant} className="flex items-center gap-1.5 text-xs">
          {statusCfg.icon} {statusCfg.label}
        </Badge>
      </div>

      {data.onboarding_status === 'rejected' && data.review_notes && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive">Admin Feedback:</p>
            <p className="text-sm mt-1">{data.review_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Personal Details */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Personal Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input value={data.full_name} onChange={e => handleChange('full_name', e.target.value)} disabled={!isEditable} placeholder="Enter full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Father's Name <span className="text-destructive">*</span></Label>
            <Input value={data.fathers_name} onChange={e => handleChange('fathers_name', e.target.value)} disabled={!isEditable} placeholder="Enter father's name" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Aadhaar Card Number <span className="text-destructive">*</span></Label>
            <Input value={data.aadhar_number} onChange={e => handleChange('aadhar_number', e.target.value.replace(/[^0-9\s]/g, '').slice(0, 14))} disabled={!isEditable} placeholder="XXXX XXXX XXXX" maxLength={14} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Referral Code <span className="text-muted-foreground text-xs">(optional — if referred by another agent)</span></Label>
            <Input value={data.referred_by_code} onChange={e => handleChange('referred_by_code', e.target.value.toUpperCase())} disabled={!isEditable} placeholder="e.g. RAHUL001" maxLength={20} />
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Account Holder Name <span className="text-destructive">*</span></Label>
            <Input value={data.bank_account_name} onChange={e => handleChange('bank_account_name', e.target.value)} disabled={!isEditable} placeholder="As per bank records" />
          </div>
          <div className="space-y-1.5">
            <Label>Account Number <span className="text-destructive">*</span></Label>
            <Input value={data.bank_account_number} onChange={e => handleChange('bank_account_number', e.target.value.replace(/[^0-9]/g, ''))} disabled={!isEditable} placeholder="Enter account number" />
          </div>
          <div className="space-y-1.5">
            <Label>IFSC Code <span className="text-destructive">*</span></Label>
            <Input value={data.bank_ifsc} onChange={e => handleChange('bank_ifsc', e.target.value.toUpperCase().slice(0, 11))} disabled={!isEditable} placeholder="e.g. SBIN0001234" maxLength={11} />
          </div>
          <div className="space-y-1.5">
            <Label>Bank Name <span className="text-destructive">*</span></Label>
            <Input value={data.bank_name} onChange={e => handleChange('bank_name', e.target.value)} disabled={!isEditable} placeholder="e.g. State Bank of India" />
          </div>
        </CardContent>
      </Card>

      {/* Document Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document Upload</CardTitle>
          <CardDescription>Upload scanned copies of your Aadhaar card (front & back). Max 10 MB per file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['aadhar_front', 'aadhar_back'] as const).map(docType => {
            const existing = documents.filter(d => d.document_type === docType);
            const label = docType === 'aadhar_front' ? 'Aadhaar Card — Front' : 'Aadhaar Card — Back';
            return (
              <div key={docType} className="space-y-2">
                <Label>{label}</Label>
                {existing.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{doc.file_name}</span>
                    {isEditable && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDoc(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {isEditable && existing.length === 0 && (
                  <label className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading === docType ? 'Uploading...' : 'Click to upload'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      disabled={uploading !== null}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(docType, f); }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Additional Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map(field => (
              <div key={field.id} className="space-y-1.5">
                <Label>
                  {field.field_label}
                  {field.is_required && <span className="text-destructive"> *</span>}
                </Label>
                {field.field_type === 'select' && field.options.length > 0 ? (
                  <Select
                    value={data.custom_fields[field.field_name] || ''}
                    onValueChange={v => handleCustomChange(field.field_name, v)}
                    disabled={!isEditable}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                    value={data.custom_fields[field.field_name] || ''}
                    onChange={e => handleCustomChange(field.field_name, e.target.value)}
                    disabled={!isEditable}
                    placeholder={`Enter ${field.field_label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {isEditable && (
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </div>
      )}

      {data.onboarding_status === 'submitted' && (
        <p className="text-center text-sm text-muted-foreground">Your onboarding has been submitted and is under review.</p>
      )}

      {data.onboarding_status === 'approved' && (
        <p className="text-center text-sm text-success font-medium">✓ Your onboarding has been approved.</p>
      )}
    </div>
  );
}
