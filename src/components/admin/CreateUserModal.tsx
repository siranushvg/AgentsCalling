import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, UserPlus, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CITY_OPTIONS = [
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai',
  'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
  'Kochi', 'Chandigarh', 'Indore', 'Nagpur', 'Coimbatore',
];

const LANGUAGE_OPTIONS = [
  'Hindi', 'English', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Gujarati', 'Bengali',
];

const SHIFT_HOURS_OPTIONS = [
  '09 to 06', '10 to 07', '11 to 08', '12 to 09',
];

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultRole?: 'agent' | 'admin' | 'team_lead';
}

export function CreateUserModal({ open, onClose, onCreated, defaultRole = 'agent' }: CreateUserModalProps) {
  const [role, setRole] = useState<string>(defaultRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [shiftHours, setShiftHours] = useState('');
  const [joiningDate, setJoiningDate] = useState<Date | undefined>();
  const [voicelayUsername, setVoicelayUsername] = useState('');
  const [voicelayExtension, setVoicelayExtension] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFullName(''); setEmail(''); setPassword('');
    setPhone(''); setCity(''); setLanguages([]);
    setShiftHours(''); setJoiningDate(undefined);
    setVoicelayUsername(''); setVoicelayExtension('');
    setMonthlySalary(''); setReferredBy(''); setRole(defaultRole);
  };

  const addLanguage = (lang: string) => {
    if (lang && !languages.includes(lang)) {
      setLanguages(prev => [...prev, lang]);
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguages(prev => prev.filter(l => l !== lang));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('You must be logged in.'); setLoading(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
            full_name: fullName.trim(),
            phone: phone.trim(),
            city: city.trim(),
            languages,
            role,
            voicelay_username: voicelayUsername.trim() || undefined,
            voicelay_extension: voicelayExtension.trim() || undefined,
            monthly_salary: monthlySalary.trim() ? Number(monthlySalary) : 0,
            referred_by: referredBy.trim() || undefined,
            joining_date: joiningDate ? format(joiningDate, 'yyyy-MM-dd') : undefined,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok && res.status !== 207) {
        toast.error(result.error || 'Failed to create user');
      } else {
        toast.success(`${role === 'admin' ? 'Admin' : 'Agent'} account created for ${email}`);
        resetForm();
        onCreated();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const isAgent = role === 'agent' || role === 'team_lead';
  const availableLanguages = LANGUAGE_OPTIONS.filter(l => !languages.includes(l));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New {role === 'admin' ? 'Admin' : 'Agent'} Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="team_lead">Team Lead</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Agent name" required />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Email (Login) *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." />
            </div>
            {isAgent && (
              <>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {CITY_OPTIONS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Languages</Label>
                  <div className="space-y-2">
                    {languages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {languages.map(lang => (
                          <Badge key={lang} variant="secondary" className="gap-1 pr-1">
                            {lang}
                            <button type="button" onClick={() => removeLanguage(lang)}
                              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {availableLanguages.length > 0 && (
                      <Select value="" onValueChange={addLanguage}>
                        <SelectTrigger><SelectValue placeholder="Add language..." /></SelectTrigger>
                        <SelectContent>
                          {availableLanguages.map(l => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Shift Hours</Label>
                  <Select value={shiftHours} onValueChange={setShiftHours}>
                    <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                    <SelectContent>
                      {SHIFT_HOURS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Joining Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" type="button"
                        className={cn("w-full justify-start text-left font-normal", !joiningDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {joiningDate ? format(joiningDate, 'PPP') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={joiningDate} onSelect={setJoiningDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Voicelay Username</Label>
                  <Input value={voicelayUsername} onChange={e => setVoicelayUsername(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>Voicelay Extension</Label>
                  <Input type="number" value={voicelayExtension} onChange={e => setVoicelayExtension(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Monthly Salary (₹)</Label>
                  <Input type="number" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} placeholder="e.g. 28000" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Referred By Code</Label>
                  <Input
                    value={referredBy}
                    onChange={e => setReferredBy(e.target.value.toUpperCase())}
                    placeholder="e.g. YASH753"
                    className="font-mono uppercase tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">Enter the referral code of the agent who referred this person. This links them into the commission chain.</p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Create Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
