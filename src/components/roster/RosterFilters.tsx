import React from 'react';
import { Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface RosterFiltersProps {
  shiftFilter: string;
  setShiftFilter: (v: string) => void;
  teamFilter: string;
  setTeamFilter: (v: string) => void;
  languageFilter: string;
  setLanguageFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onlyOverrides: boolean;
  setOnlyOverrides: (v: boolean) => void;
}

export function RosterFilters({
  shiftFilter, setShiftFilter,
  teamFilter, setTeamFilter,
  languageFilter, setLanguageFilter,
  statusFilter, setStatusFilter,
  onlyOverrides, setOnlyOverrides,
}: RosterFiltersProps) {
  const selectClass = "h-8 rounded-md border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span className="font-medium">Filters</span>
      </div>
      <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} className={selectClass}>
        <option value="">All Shifts</option>
        <option value="morning">Morning</option>
        <option value="afternoon">Afternoon</option>
        <option value="evening">Evening</option>
        <option value="custom">Custom</option>
      </select>
      <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={selectClass}>
        <option value="">All Teams</option>
        <option value="tl1">Team Arjun</option>
        <option value="tl2">Team Sneha</option>
      </select>
      <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} className={selectClass}>
        <option value="">All Languages</option>
        <option value="Hindi">Hindi</option>
        <option value="English">English</option>
        <option value="Tamil">Tamil</option>
        <option value="Telugu">Telugu</option>
        <option value="Marathi">Marathi</option>
        <option value="Gujarati">Gujarati</option>
        <option value="Bengali">Bengali</option>
        <option value="Kannada">Kannada</option>
      </select>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="training">Training</option>
        <option value="suspended">Suspended</option>
      </select>
      <div className="w-px h-6 bg-border mx-1" />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Switch checked={onlyOverrides} onCheckedChange={setOnlyOverrides} className="scale-75" />
        <span className="text-xs font-medium text-muted-foreground">Only overrides</span>
      </label>
    </div>
  );
}
