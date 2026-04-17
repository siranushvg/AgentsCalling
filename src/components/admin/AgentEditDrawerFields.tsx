import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { toast } from 'sonner';
import { CalendarIcon, Pencil, Check, X, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CITY_OPTIONS = [
  'Agra', 'Ahmedabad', 'Ajmer', 'Aligarh', 'Allahabad', 'Ambala', 'Amravati', 'Amritsar', 'Anand', 'Aurangabad',
  'Bangalore', 'Bareilly', 'Belgaum', 'Bhilai', 'Bhopal', 'Bhubaneswar', 'Bikaner', 'Bilaspur', 'Chandigarh', 'Chennai',
  'Coimbatore', 'Cuttack', 'Dehradun', 'Delhi', 'Dhanbad', 'Durgapur', 'Erode', 'Faridabad', 'Firozabad', 'Gangtok',
  'Ghaziabad', 'Gorakhpur', 'Guntur', 'Gurugram', 'Guwahati', 'Gwalior', 'Hubli', 'Hyderabad', 'Imphal', 'Indore',
  'Jabalpur', 'Jaipur', 'Jalandhar', 'Jammu', 'Jamnagar', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kanpur', 'Karnal',
  'Kochi', 'Kolhapur', 'Kolkata', 'Kota', 'Kozhikode', 'Lucknow', 'Ludhiana', 'Madurai', 'Mangalore', 'Mathura',
  'Meerut', 'Moradabad', 'Mumbai', 'Muzaffarpur', 'Mysore', 'Nagpur', 'Nanded', 'Nashik', 'Navi Mumbai', 'Noida',
  'Panaji', 'Panipat', 'Patiala', 'Patna', 'Pondicherry', 'Pune', 'Raipur', 'Rajkot', 'Ranchi', 'Rohtak',
  'Rourkela', 'Saharanpur', 'Salem', 'Sangli', 'Shimla', 'Siliguri', 'Solapur', 'Srinagar', 'Surat', 'Thane',
  'Thiruvananthapuram', 'Tiruchirappalli', 'Tirupati', 'Tiruppur', 'Udaipur', 'Ujjain', 'Vadodara', 'Varanasi',
  'Vijayawada', 'Visakhapatnam', 'Warangal',
];

const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Gujarati', 'Bengali',
  'Marathi', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Maithili', 'Konkani',
];


interface AgentEditFieldsProps {
  agentId: string;
  city: string;
  languages: string[];
  joiningDate: string | null;
  onUpdated: () => void;
}

export function AgentEditDrawerFields({ agentId, city, languages, joiningDate, onUpdated }: AgentEditFieldsProps) {
  const [editingCity, setEditingCity] = useState(false);
  const [editCity, setEditCity] = useState(city);
  const [editingLangs, setEditingLangs] = useState(false);
  const [editLangs, setEditLangs] = useState<string[]>(languages);
  const [editingDate, setEditingDate] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>(joiningDate ? new Date(joiningDate) : undefined);
  const [saving, setSaving] = useState(false);

  const saveField = async (field: string, value: any) => {
    setSaving(true);
    const { error } = await supabase.from('agents').update({ [field]: value } as Record<string, unknown>).eq('id', agentId);
    setSaving(false);
    if (error) { toast.error(`Failed to update ${field}`); }
    else { toast.success(`${field.replace('_', ' ')} updated`); onUpdated(); }
  };

  const availableLangs = LANGUAGE_OPTIONS.filter(l => !editLangs.includes(l));

  return (
    <div className="space-y-4">
      {/* City */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">City</p>
        {editingCity ? (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-sm flex-1 justify-between font-normal">
                  {editCity || 'Select city...'}
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search city..." />
                  <CommandList>
                    <CommandEmpty>No city found.</CommandEmpty>
                    <CommandGroup>
                      {CITY_OPTIONS.map(c => (
                        <CommandItem key={c} value={c} onSelect={() => setEditCity(c)}>
                          <Check className={cn('mr-2 h-3 w-3', editCity === c ? 'opacity-100' : 'opacity-0')} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={saving}
              onClick={() => { saveField('city', editCity); setEditingCity(false); }}>
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditCity(city); setEditingCity(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{city || '—'}</p>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingCity(true)}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      {/* Languages */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Languages</p>
        {editingLangs ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {editLangs.map(lang => (
                <Badge key={lang} variant="secondary" className="gap-1 pr-1">
                  {lang}
                  <button onClick={() => setEditLangs(prev => prev.filter(l => l !== lang))}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {availableLangs.length > 0 && (
              <Select value="" onValueChange={v => { if (v) setEditLangs(prev => [...prev, v]); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Add language..." /></SelectTrigger>
                <SelectContent>
                  {availableLangs.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={saving}
                onClick={() => { saveField('languages', editLangs); setEditingLangs(false); }}>
                <Check className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditLangs(languages); setEditingLangs(false); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {languages.length > 0 ? languages.map(l => (
                <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
              )) : <span className="text-sm text-muted-foreground">—</span>}
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingLangs(true)}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>

      {/* Joining Date */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Joining Date</p>
        {editingDate ? (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" type="button"
                  className={cn("text-sm font-normal", !editDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                  {editDate ? format(editDate, 'PPP') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={editDate} onSelect={setEditDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={saving}
              onClick={() => { saveField('joining_date', editDate ? format(editDate, 'yyyy-MM-dd') : null); setEditingDate(false); }}>
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditDate(joiningDate ? new Date(joiningDate) : undefined); setEditingDate(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{joiningDate ? format(new Date(joiningDate), 'dd MMM yyyy') : '—'}</p>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingDate(true)}>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
