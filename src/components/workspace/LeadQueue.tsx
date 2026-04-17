import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronDown, FileSpreadsheet, CalendarDays } from 'lucide-react';
import { Lead } from '@/types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LeadQueueProps {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (l: Lead) => void;
  activeQueueLeadId?: string | null;
}

/** Format ISO date string to dd.MM.yyyy */
function formatImportDate(isoDate: string): string {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function isTodayDate(isoDate: string): boolean {
  const now = new Date();
  return isoDate === [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

interface DateGroup {
  dateKey: string;
  displayDate: string;
  leads: Lead[];
  isToday: boolean;
}

export function LeadQueue({ leads, selectedId, onSelect, activeQueueLeadId }: LeadQueueProps) {
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  // Build all unique dates sorted newest first
  const allDateKeys = useMemo(() => {
    const dates = new Set<string>();
    for (const lead of leads) {
      dates.add(lead.import_date || lead.created_at.slice(0, 10));
    }
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [leads]);

  // Build unique languages
  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    for (const lead of leads) {
      if (lead.language) langs.add(lead.language);
    }
    return Array.from(langs).sort();
  }, [leads]);

  // Filter leads by selected date and language
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (selectedDate !== 'all') result = result.filter(l => (l.import_date || l.created_at.slice(0, 10)) === selectedDate);
    if (selectedLanguage !== 'all') result = result.filter(l => l.language === selectedLanguage);
    return result;
  }, [leads, selectedDate, selectedLanguage]);

  // Group filtered leads by date
  const dateGroups = useMemo<DateGroup[]>(() => {
    const groups = new Map<string, Lead[]>();
    for (const lead of filteredLeads) {
      const dateKey = lead.import_date || lead.created_at.slice(0, 10);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(lead);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, groupLeads]) => ({
        dateKey,
        displayDate: formatImportDate(dateKey),
        leads: groupLeads,
        isToday: isTodayDate(dateKey),
      }));
  }, [filteredLeads]);

  return (
    <div className="w-64 flex-shrink-0 rounded-lg border bg-card shadow-sm flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 space-y-2">
        <div>
          <h3 className="font-semibold text-sm">User Queue</h3>
          <p className="text-xs text-muted-foreground">
            {filteredLeads.length} user{filteredLeads.length !== 1 ? 's' : ''}
            {selectedDate !== 'all' && ` · ${formatImportDate(selectedDate)}`}
          </p>
        </div>
        {/* Date filter dropdown */}
        {allDateKeys.length > 0 && (
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="h-8 text-xs w-full">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates ({leads.length})</SelectItem>
              {allDateKeys.map((dk) => (
                <SelectItem key={dk} value={dk}>
                  {formatImportDate(dk)} ({leads.filter(l => (l.import_date || l.created_at.slice(0, 10)) === dk).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Language filter dropdown */}
        {allLanguages.length > 1 && (
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue placeholder="Filter by language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {allLanguages.map(lang => (
                <SelectItem key={lang} value={lang}>
                  {lang} ({leads.filter(l => l.language === lang).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">No users available in workspace</p>
            <p className="text-xs text-muted-foreground">
              Imported users with valid mobile numbers will appear here.
            </p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No leads for this date</p>
            <p className="text-xs text-muted-foreground">Try selecting a different date above.</p>
          </div>
        ) : (
          dateGroups.map((group) => (
            <DateGroupSection
              key={group.dateKey}
              group={group}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultOpen={selectedDate !== 'all' || group.isToday || dateGroups.length === 1}
              activeQueueLeadId={activeQueueLeadId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DateGroupSection({
  group,
  selectedId,
  onSelect,
  defaultOpen,
  activeQueueLeadId,
}: {
  group: DateGroup;
  selectedId: string | null;
  onSelect: (l: Lead) => void;
  defaultOpen: boolean;
  activeQueueLeadId?: string | null;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b hover:bg-muted/60 transition-colors cursor-pointer">
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              !open && '-rotate-90'
            )}
          />
          <span className="text-xs font-semibold">{group.displayDate}</span>
          {group.isToday && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Today
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {group.leads.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.leads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={cn(
              'w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent/50',
              activeQueueLeadId === lead.id && 'bg-emerald-100 dark:bg-emerald-900/30 border-l-4 border-l-emerald-500',
              selectedId === lead.id && activeQueueLeadId !== lead.id && 'bg-accent',
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium font-mono">
                {lead.serial_number != null && (
                  <span className="text-muted-foreground mr-1.5">{lead.serial_number}.</span>
                )}
                {lead.username}
              </span>
              {(() => {
                const regDate = new Date(lead.created_at);
                const daysSince = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
                const heat = daysSince < 3 ? 'hot' : 'cool';
                return <StatusBadge variant={heat}>{heat}</StatusBadge>;
              })()}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Reg: {new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
