import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle2, Download, Loader2, Trash2 } from 'lucide-react';
import { LeadDistributionTab } from '@/components/admin/LeadDistributionTab';

const MAX_IMPORT_ROWS = 100_000;
const BATCH_SIZE = 500;

/** Normalize one phone value into a canonical 10-digit key */
function normalizePhone(raw: string): string {
  let p = String(raw ?? '').trim();
  if (/^\d+\.0+$/.test(p)) p = p.replace(/\.0+$/, '');
  p = p.replace(/\D/g, '');
  p = p.replace(/^91(?=\d{10}$)/, '').replace(/^0+/, '');
  if (p.length > 10) p = p.slice(-10);
  return p;
}

/**
 * Extract valid phone tokens from cells that may contain one number,
 * spreadsheet-style decimals, or whitespace/newline-separated values.
 */
function extractPhoneTokens(raw: unknown): string[] {
  const value = String(raw ?? '').replace(/\.0+\b/g, '').trim();
  const digitRuns = value.match(/\d+/g) ?? [];
  const phones = new Set<string>();
  let buffer = '';

  const pushPhone = (candidate: string) => {
    const normalized = normalizePhone(candidate);
    if (/^\d{10}$/.test(normalized)) phones.add(normalized);
  };

  for (const run of digitRuns) {
    const digits = run.replace(/\D/g, '');
    if (!digits) continue;

    if (!buffer) {
      if (digits.length >= 10) {
        pushPhone(digits);
      } else {
        buffer = digits;
      }
      continue;
    }

    const combined = buffer + digits;
    if (combined.length <= 12) {
      buffer = combined;
      if (buffer.length >= 10) {
        pushPhone(buffer);
        buffer = '';
      }
      continue;
    }

    pushPhone(buffer);
    if (digits.length >= 10) {
      pushPhone(digits);
      buffer = '';
    } else {
      buffer = digits;
    }
  }

  if (buffer) pushPhone(buffer);

  return [...phones];
}

function parseRegistrationDate(raw: unknown): Date | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const normalized = value.replace(/^\uFEFF/, '').trim();
  const localMatch = normalized.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (localMatch) {
    const [, dayStr, monthStr, yearStr, hourStr = '0', minuteStr = '0', secondStr = '0'] = localMatch;
    const day = Number(dayStr);
    const month = Number(monthStr);
    const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr);

    const date = new Date(year, month - 1, day, hour, minute, second);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second
    ) {
      return date;
    }

    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCsvValue(value: unknown): string {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function hasRowValues(row: Record<string, string>) {
  return Object.values(row).some((value) => value !== '');
}

function buildRowFromCells(headers: string[], cells: unknown[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = normalizeCsvValue(cells[index]);
    return acc;
  }, {});
}

function normalizeStructuredRow(row: Record<string, unknown>, headers: string[]): Record<string, string> {
  return headers.reduce<Record<string, string>>((acc, header) => {
    acc[header] = normalizeCsvValue(row?.[header]);
    return acc;
  }, {});
}

function detectDelimiter(value: string): string {
  const candidates = [';', ',', '\t', '|'] as const;
  return candidates.reduce(
    (best, candidate) => {
      const score = value.split(candidate).length - 1;
      return score > best.score ? { delimiter: candidate, score } : best;
    },
    { delimiter: ';', score: 0 },
  ).delimiter;
}

function parseCsvContent(source: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleanedSource = source.replace(/^\uFEFF/, '');
  const baseResult = Papa.parse<Record<string, unknown>>(cleanedSource, {
    header: true,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t', '|'],
    transformHeader: (header) => normalizeCsvValue(header),
    transform: (value) => normalizeCsvValue(value),
  });

  let headers = (baseResult.meta.fields || []).map(normalizeCsvValue).filter(Boolean);
  let rows = ((baseResult.data || []) as Record<string, unknown>[])
    .map((row) => normalizeStructuredRow(row, headers))
    .filter(hasRowValues);

  const headerSource = headers[0] || cleanedSource.split(/\r?\n/, 1)[0] || '';
  const shouldFallback = headers.length <= 1 && /[;,\t|]/.test(headerSource);

  if (shouldFallback) {
    const fallbackResult = Papa.parse<string[]>(cleanedSource, {
      header: false,
      delimiter: detectDelimiter(headerSource),
      skipEmptyLines: 'greedy',
      transform: (value) => normalizeCsvValue(value),
    });

    const [headerRow = [], ...dataRows] = (fallbackResult.data || []) as string[][];
    const fallbackHeaders = headerRow.map(normalizeCsvValue).filter(Boolean);

    if (fallbackHeaders.length > 1) {
      headers = fallbackHeaders;
      rows = dataRows.map((cells) => buildRowFromCells(headers, cells)).filter(hasRowValues);
    }
  }

  return { headers, rows };
}

// System field keys for the leads table
const SYSTEM_FIELDS = [
  { key: 'username', label: 'User ID', required: true },
  { key: 'phone_number', label: 'Mobile Number', required: true },
  { key: 'registration_date', label: 'Registration Date', required: true },
] as const;

type ImportMode = 'create_new' | 'update_existing' | 'skip_duplicates';

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  resolvedPhone: string;
  resolvedSignupAt: string;
  errors: string[];
  isDuplicate: boolean;
  isValid: boolean;
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; error: string }[];
}

interface ImportHistory {
  id: string;
  file_name: string;
  total_rows: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  status: string;
  import_mode: string;
  created_at: string;
  error_details: { row: number; error: string }[];
}

// -- Helpers --
function generateSampleCSV() {
  const header = 'user_id,phone_number,registration_date';
  const rows = [
    'USR001,+919876543210,2026-03-25',
    'USR002,+919876543211,2026-03-20',
    'USR003,+919876543212,2026-03-15',
  ];
  return [header, ...rows].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateRow(row: Record<string, string>, mapping: Record<string, string>): string[] {
  const errors: string[] = [];
  const get = (sysKey: string) => {
    const csvCol = mapping[sysKey];
    return csvCol ? (row[csvCol] || '').trim() : '';
  };

  if (!get('username')) errors.push('Missing user_id');
  const phoneValue = get('phone_number');
  if (!phoneValue) {
    errors.push('Missing phone number');
  } else if (extractPhoneTokens(phoneValue).length === 0) {
    errors.push('Invalid phone number');
  }

  const regDate = get('registration_date');
  if (!regDate) {
    errors.push('Missing registration date');
  } else if (!parseRegistrationDate(regDate)) {
    errors.push(`Invalid registration date "${regDate}"`);
  }

  return errors;
}

export default function AdminLeadImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationRunRef = useRef(0);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('skip_duplicates');
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'result'>('upload');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [validatingPreview, setValidatingPreview] = useState(false);

  // History state
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);



  // -- Load history --
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('csv_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setHistory(data.map((d: any) => ({
        ...d,
        error_details: Array.isArray(d.error_details) ? d.error_details : [],
      })));
    }
    setHistoryLoading(false);
  }, []);

  React.useEffect(() => { loadHistory(); }, [loadHistory]);




  // -- File handling --
  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV file.', variant: 'destructive' });
      return;
    }

    validationRunRef.current += 1;
    setFile(f);

    setParsedRows([]);
    setRawRows([]);
    setCsvHeaders([]);
    setMapping({});
    setValidatingPreview(false);

    try {
      const source = await f.text();
      const { headers, rows } = parseCsvContent(source);

      if (rows.length === 0 || headers.length === 0) {
        toast({
          title: 'No data found',
          description: 'We could not detect any CSV rows. Please check the delimiter and header row.',
          variant: 'destructive',
        });
        return;
      }

      if (rows.length > MAX_IMPORT_ROWS) {
        toast({ title: 'File too large', description: `Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows allowed. Your file has ${rows.length.toLocaleString()} rows.`, variant: 'destructive' });
        return;
      }

      setCsvHeaders(headers);
      setRawRows(rows);

      const autoMap: Record<string, string> = {};
      for (const sf of SYSTEM_FIELDS) {
        const match = headers.find(h => {
          const norm = h.toLowerCase().replace(/[\s_-]/g, '');
          const keyNorm = sf.key.replace(/_/g, '');
          if (sf.key === 'username') return norm === keyNorm || norm === 'userid';
          if (sf.key === 'phone_number') return norm === keyNorm || norm === 'mobilenumber' || norm === 'mobile';
          if (sf.key === 'registration_date') return norm === keyNorm || norm === 'registrationdate' || norm === 'regdate';
          return norm === keyNorm;
        });
        if (match) autoMap[sf.key] = match;
      }

      setMapping(autoMap);
      setStep('preview');
    } catch (error) {
      console.error('CSV parse failed:', error);
      toast({ title: 'Parse error', description: 'Failed to parse CSV file.', variant: 'destructive' });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // -- Validate all rows --
   const runValidation = useCallback(async () => {
    const validationId = ++validationRunRef.current;
    const phoneCol = mapping['phone_number'];
    const registrationDateCol = mapping['registration_date'];

    const baseParsed: ParsedRow[] = rawRows.map((row, i) => {
      const errors = validateRow(row, mapping);
      const rowPhones = phoneCol ? extractPhoneTokens(row[phoneCol] || '') : [];
      const rawRegistrationDate = registrationDateCol ? (row[registrationDateCol] || '') : '';
      const parsedRegistrationDate = parseRegistrationDate(rawRegistrationDate);

      return {
        rowIndex: i + 2,
        data: row,
        resolvedPhone: rowPhones[0] ?? '',
        resolvedSignupAt: parsedRegistrationDate?.toISOString() ?? '',
        errors,
        isDuplicate: false,
        isValid: errors.length === 0,
      };
    });

    setParsedRows(baseParsed);

    if (!phoneCol) {
      setValidatingPreview(false);
      return;
    }

    setValidatingPreview(true);

    try {
      const importKeys = [...new Set(baseParsed.map((row) => row.resolvedPhone).filter((phone) => /^\d{10}$/.test(phone)))];
      const existingKeys = new Set<string>();

      if (importKeys.length > 0) {
        const queryPhones = [...new Set(importKeys.flatMap((phone) => [phone, `91${phone}`]))];

        for (let i = 0; i < queryPhones.length; i += BATCH_SIZE) {
          const chunk = queryPhones.slice(i, i + BATCH_SIZE);
          const { data } = await supabase.from('leads').select('phone_number').in('phone_number', chunk);

          if (validationRunRef.current !== validationId) return;

          if (data) {
            data.forEach((lead) => {
              extractPhoneTokens(lead.phone_number).forEach((phone) => existingKeys.add(phone));
            });
          }
        }
      }

      if (validationRunRef.current !== validationId) return;

      const seenInFile = new Set<string>();
      const parsedWithDuplicates = baseParsed.map((parsedRow) => {
        const rowPhones = phoneCol ? extractPhoneTokens(parsedRow.data[phoneCol] || '') : [];
        const isDbDuplicate = rowPhones.length > 0 && rowPhones.every((phone) => existingKeys.has(phone));
        const isFileDuplicate = rowPhones.length > 0 && rowPhones.every((phone) => seenInFile.has(phone));
        const resolvedPhone =
          rowPhones.find((phone) => !existingKeys.has(phone) && !seenInFile.has(phone)) ??
          rowPhones.find((phone) => !seenInFile.has(phone)) ??
          rowPhones[0] ??
          '';

        rowPhones.forEach((phone) => seenInFile.add(phone));

        return {
          ...parsedRow,
          resolvedPhone,
          isDuplicate: isDbDuplicate || isFileDuplicate,
        };
      });

      setParsedRows(parsedWithDuplicates);
    } catch (error) {
      console.error('Lead validation failed:', error);
    } finally {
      if (validationRunRef.current === validationId) {
        setValidatingPreview(false);
      }
    }
  }, [rawRows, mapping]);

  React.useEffect(() => {
    if (step === 'preview' && rawRows.length > 0) {
      runValidation();
    }
  }, [step, rawRows, mapping, runValidation]);

  const validCount = parsedRows.filter(r => r.isValid && !r.isDuplicate).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate && r.isValid).length;

  // -- Import --
  const doImport = async () => {
    if (!user) return;
    setShowConfirmDialog(false);
    setImporting(true);
    setImportProgress(0);
    setStep('result');

    const res: ImportResult = { total: parsedRows.length, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
    const batchId = crypto.randomUUID();
    const get = (row: Record<string, string>, sysKey: string) => {
      const csvCol = mapping[sysKey];
      return csvCol ? (row[csvCol] || '').trim() : '';
    };

    // Separate rows into categories
    const toInsert: ParsedRow[] = [];
    const toUpdate: ParsedRow[] = [];

    for (const pr of parsedRows) {
      if (!pr.isValid) {
        res.failed++;
        res.errors.push({ row: pr.rowIndex, error: pr.errors.join('; ') });
        continue;
      }
      if (pr.isDuplicate) {
        if (importMode === 'update_existing') {
          toUpdate.push(pr);
        } else {
          res.skipped++;
        }
        continue;
      }
      toInsert.push(pr);
    }

    const totalWork = toInsert.length + toUpdate.length;
    let processed = 0;

    const updateProgress = (count: number) => {
      processed += count;
      setImportProgress(totalWork > 0 ? Math.round((processed / totalWork) * 100) : 100);
    };

    // Batch inserts
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const rows = chunk.map(pr => {
        const regDateMs = new Date(pr.resolvedSignupAt).getTime();
        const isRecent = !isNaN(regDateMs) && (Date.now() - regDateMs) < 3 * 24 * 60 * 60 * 1000;
        return {
          username: get(pr.data, 'username'),
          phone_number: pr.resolvedPhone,
          state: 'N/A',
          language: 'English',
          signup_at: pr.resolvedSignupAt,
          status: 'new' as const,
          temperature: (isRecent ? 'hot' : 'cool') as 'hot' | 'warm' | 'cool',
          import_date: new Date().toISOString().slice(0, 10),
          import_timestamp: new Date().toISOString(),
          import_batch_id: batchId,
          imported_by_admin: user.id,
        };
      });
      const { error, data } = await supabase.from('leads').insert(rows as any).select('id');
      if (error) {
        // Fall back to individual inserts for this chunk to identify failing rows
        for (const pr of chunk) {
          const { error: rowErr } = await supabase.from('leads').insert({
            username: get(pr.data, 'username'),
            phone_number: pr.resolvedPhone,
            state: 'N/A',
            language: 'English',
            signup_at: pr.resolvedSignupAt,
            status: 'new',
            temperature: 'cool',
            import_date: new Date().toISOString().slice(0, 10),
            import_timestamp: new Date().toISOString(),
            import_batch_id: batchId,
            imported_by_admin: user.id,
          } as any);
          if (rowErr) {
            res.failed++;
            res.errors.push({ row: pr.rowIndex, error: rowErr.message });
          } else {
            res.imported++;
          }
        }
      } else {
        res.imported += chunk.length;
      }
      updateProgress(chunk.length);
    }

    // Handle updates one-by-one (can't batch updates easily)
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);
      for (const pr of chunk) {
        const phone = pr.resolvedPhone;
        const { error } = await supabase
          .from('leads')
          .update({
            username: get(pr.data, 'username'),
            signup_at: pr.resolvedSignupAt,
          })
          .in('phone_number', [phone, `91${phone}`]);
        if (error) {
          res.failed++;
          res.errors.push({ row: pr.rowIndex, error: error.message });
        } else {
          res.updated++;
        }
      }
      updateProgress(chunk.length);
    }

    // Auto-distribute imported leads among active agents
    if (res.imported > 0) {
      const { data: distResult, error: distError } = await supabase.rpc('distribute_leads_to_agents', { p_batch_id: batchId });
      if (distError) {
        console.error('Lead distribution failed:', distError);
        toast({ title: 'Warning', description: 'Leads imported but auto-distribution failed. You can manually assign them.', variant: 'destructive' });
      } else if (distResult) {
        const dr = distResult as { distributed: number; agents: number; error?: string };
        if (dr.error) {
          toast({ title: 'Distribution Note', description: dr.error });
        } else {
          toast({ title: 'Leads Distributed', description: `${dr.distributed} leads distributed among ${dr.agents} active agents.` });
        }
      }
    }

    // Log import
    await supabase.from('csv_imports').insert({
      admin_user_id: user.id,
      file_name: file?.name || 'unknown.csv',
      total_rows: res.total,
      imported_count: res.imported,
      updated_count: res.updated,
      skipped_count: res.skipped,
      failed_count: res.failed,
      status: res.failed === res.total ? 'failed' : 'completed',
      import_mode: importMode,
      error_details: res.errors as any,
      import_batch_id: batchId,
    } as any);

    // Log activity
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      actor_role: 'admin',
      action: 'csv_import',
      target_type: 'leads',
      target_id: file?.name || 'csv',
      details: `Imported ${res.imported} leads, updated ${res.updated}, skipped ${res.skipped}, failed ${res.failed}`,
    });

    setResult(res);
    setImporting(false);
    loadHistory();
  };

  // -- Reset --
  const resetAll = () => {
    validationRunRef.current += 1;
    setFile(null);
    setRawRows([]);
    setCsvHeaders([]);
    setMapping({});
    setParsedRows([]);
    setResult(null);
    setImportProgress(0);
    setValidatingPreview(false);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -- Render --
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Import</h1>
        <p className="text-muted-foreground text-sm">Upload CSV files to import leads into the platform pipeline.</p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="distribution">Lead Distribution</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        {/* ===== IMPORT TAB ===== */}
        <TabsContent value="import" className="space-y-4 mt-4">

          {/* STEP: Upload */}
          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload CSV File</CardTitle>
                <CardDescription>Drag and drop a CSV file or click to browse (max {MAX_IMPORT_ROWS.toLocaleString()} rows). Required columns: user_id, phone_number, registration_date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Accepted format: .csv</p>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileSelect} />
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadCSV(generateSampleCSV(), 'lead_import_template.csv')}>
                  <Download className="h-4 w-4 mr-1" /> Download Sample Template
                </Button>
              </CardContent>
            </Card>
          )}

          {/* STEP: Preview & Validation */}
          {step === 'preview' && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{parsedRows.length}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{validCount}</p>
                  <p className="text-xs text-muted-foreground">Valid</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
                  <p className="text-xs text-muted-foreground">Invalid</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{duplicateCount}</p>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </CardContent></Card>
              </div>

              {validatingPreview && (
                <p className="text-xs text-muted-foreground">Rows are loaded. Duplicate checking is still running in the background.</p>
              )}

              {/* Column mapping */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Column Mapping</CardTitle>
                  <CardDescription>Map your CSV columns to system fields. Required fields are marked with *.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {SYSTEM_FIELDS.map(sf => (
                      <div key={sf.key} className="space-y-1">
                        <label className="text-xs font-medium">
                          {sf.label} {sf.required && <span className="text-destructive">*</span>}
                        </label>
                        <Select value={mapping[sf.key] || '_none'} onValueChange={v => setMapping(prev => ({ ...prev, [sf.key]: v === '_none' ? '' : v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">— Not mapped —</SelectItem>
                            {csvHeaders.filter(h => h !== '').map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Import mode */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Duplicate Handling</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={importMode} onValueChange={v => setImportMode(v as ImportMode)}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip_duplicates">Skip duplicates</SelectItem>
                      <SelectItem value="update_existing">Update existing matches</SelectItem>
                      <SelectItem value="create_new">Create new only (skip dupes)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Preview table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Row Preview</CardTitle>
                  <CardDescription>
                    Showing all {parsedRows.length.toLocaleString()} rows.{validatingPreview ? ' Duplicate checks are still running.' : ' Errors are highlighted.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[70vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                          {SYSTEM_FIELDS.map(sf => (
                            <TableHead key={sf.key}>{sf.label}</TableHead>
                          ))}
                          <TableHead>Errors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedRows.map(pr => {
                          const get = (k: string) => mapping[k] ? (pr.data[mapping[k]] || '') : '';
                          return (
                            <TableRow key={pr.rowIndex} className={!pr.isValid ? 'bg-destructive/5' : pr.isDuplicate ? 'bg-yellow-500/5' : ''}>
                              <TableCell className="text-xs text-muted-foreground">{pr.rowIndex}</TableCell>
                              <TableCell>
                                {!pr.isValid ? <Badge variant="destructive" className="text-[10px]">Invalid</Badge>
                                  : pr.isDuplicate ? <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Duplicate</Badge>
                                  : <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">Valid</Badge>}
                              </TableCell>
                              {SYSTEM_FIELDS.map(sf => (
                                <TableCell key={sf.key} className="text-xs max-w-[140px] truncate">{get(sf.key) || <span className="text-muted-foreground/40">—</span>}</TableCell>
                              ))}
                              <TableCell className="text-xs text-destructive max-w-[200px]">{pr.errors.join(', ')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={resetAll}><Trash2 className="h-4 w-4 mr-1" /> Cancel</Button>
                <Button onClick={() => setShowConfirmDialog(true)} disabled={validCount === 0 || validatingPreview}>
                  {validatingPreview ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {validatingPreview ? 'Validating rows…' : `Confirm Import (${validCount + (importMode === 'update_existing' ? duplicateCount : 0)} rows)`}
                </Button>
              </div>

              {/* Confirm dialog */}
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Lead Import</DialogTitle>
                    <DialogDescription>This will import leads into the platform pipeline. Agents will be able to see eligible leads.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 text-sm">
                    <p><strong>File:</strong> {file?.name}</p>
                    <p><strong>Mode:</strong> {importMode.replace(/_/g, ' ')}</p>
                    <p><strong>Valid rows:</strong> {validCount}</p>
                    <p><strong>Duplicates:</strong> {duplicateCount} ({importMode === 'update_existing' ? 'will update' : 'will skip'})</p>
                    <p><strong>Invalid (skipped):</strong> {invalidCount}</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
                    <Button onClick={doImport}>Import Now</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* STEP: Result */}
          {step === 'result' && (
            <>
              {importing ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-4 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Importing leads… {importProgress}%</p>
                    <Progress value={importProgress} className="w-64" />
                    <p className="text-xs text-muted-foreground">{parsedRows.length.toLocaleString()} rows total</p>
                  </CardContent>
                </Card>
              ) : result && (
                <>
                  <div className="grid grid-cols-5 gap-4">
                    {[
                      { label: 'Total', value: result.total, color: '' },
                      { label: 'Imported', value: result.imported, color: 'text-green-600' },
                      { label: 'Updated', value: result.updated, color: 'text-blue-600' },
                      { label: 'Skipped', value: result.skipped, color: 'text-yellow-600' },
                      { label: 'Failed', value: result.failed, color: 'text-red-600' },
                    ].map(s => (
                      <Card key={s.label}><CardContent className="pt-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </CardContent></Card>
                    ))}
                  </div>

                  {result.errors.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Error Details</CardTitle>
                          <Button variant="outline" size="sm" onClick={() => {
                            const csv = 'Row,Error\n' + result.errors.map(e => `${e.row},"${e.error}"`).join('\n');
                            downloadCSV(csv, 'import_errors.csv');
                          }}>
                            <Download className="h-4 w-4 mr-1" /> Download Error Report
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="max-h-[300px]">
                          <Table>
                            <TableHeader><TableRow><TableHead className="w-16">Row</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {result.errors.slice(0, 100).map((e, i) => (
                                <TableRow key={i}><TableCell className="text-xs">{e.row}</TableCell><TableCell className="text-xs text-destructive">{e.error}</TableCell></TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  <Button onClick={resetAll}>Import Another File</Button>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import History</CardTitle>
              <CardDescription>Review past CSV imports.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm font-medium">No CSV imports yet</p>
                  <p className="text-xs">Upload a CSV file to import new leads into the platform.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Imported</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs font-medium max-w-[180px] truncate">{h.file_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{h.import_mode.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="text-right text-xs">{h.total_rows}</TableCell>
                        <TableCell className="text-right text-xs text-green-600">{h.imported_count}</TableCell>
                        <TableCell className="text-right text-xs text-blue-600">{h.updated_count}</TableCell>
                        <TableCell className="text-right text-xs text-yellow-600">{h.skipped_count}</TableCell>
                        <TableCell className="text-right text-xs text-red-600">{h.failed_count}</TableCell>
                        <TableCell>
                          <Badge variant={h.status === 'completed' ? 'default' : 'destructive'} className="text-[10px]">
                            {h.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DISTRIBUTION TAB ===== */}
        <TabsContent value="distribution" className="mt-4">
          <LeadDistributionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
