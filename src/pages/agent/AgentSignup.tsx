import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentCommissionRates } from '@/data/mockData';
import { CheckCircle, UserPlus, Globe, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Bengali', 'Kannada'] as const;

export default function AgentSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    city: '',
    languages: [] as string[],
    referralCode: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const rates = currentCommissionRates;

  const toggleLanguage = (lang: string) => {
    setForm(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.email || !form.city || form.languages.length === 0) {
      toast.error('Please fill all required fields and select at least one language.');
      return;
    }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Signup successful! Redirecting to training...');
    setSubmitting(false);
    setTimeout(() => navigate('/login'), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Platform Intro */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bluesparrow</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            A professional agent platform connecting multilingual sales teams with high-intent leads. 
            Earn commissions, grow your network, and build a career from anywhere.
          </p>
        </div>

        {/* Value Props */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <Globe className="h-5 w-5 text-primary mx-auto" />
            <p className="text-sm font-medium">Multilingual</p>
            <p className="text-xs text-muted-foreground">Work in your preferred language with leads matched to you</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <Wallet className="h-5 w-5 text-earning mx-auto" />
            <p className="text-sm font-medium">Earn Daily</p>
            <p className="text-xs text-muted-foreground">Commission on every FTD plus Minimum Guarantee protection</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center space-y-2">
            <ShieldCheck className="h-5 w-5 text-success mx-auto" />
            <p className="text-sm font-medium">Certified</p>
            <p className="text-xs text-muted-foreground">Complete training to unlock your full workspace and start earning</p>
          </div>
        </div>

        {/* Commission Rates Banner */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-muted-foreground mb-1">CURRENT LIVE COMMISSION RATES</h3>
          <p className="text-xs text-muted-foreground mb-3">These are the active rates for all new agent conversions</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-earning/10 p-3 text-center">
              <p className="text-xl font-bold text-earning">{rates.direct_rate}%</p>
              <p className="text-xs text-muted-foreground">Direct FTD</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Your conversion</p>
            </div>
            <div className="rounded-lg bg-info/10 p-3 text-center">
              <p className="text-xl font-bold text-info">{rates.tier2_rate}%</p>
              <p className="text-xs text-muted-foreground">Tier 2 Referral</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Your referral's FTD</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3 text-center">
              <p className="text-xl font-bold text-primary">{rates.tier3_rate}%</p>
              <p className="text-xs text-muted-foreground">Tier 3 Referral</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Referral's referral</p>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Join Bluesparrow</h2>
            <p className="text-sm text-muted-foreground mt-1">Create your account and start your certification journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Your city"
                  required
                />
              </div>
            </div>

            {/* Languages Multi-Select */}
            <div className="space-y-2">
              <Label>Languages Spoken * <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
              <p className="text-xs text-muted-foreground">You'll receive leads matched to your languages for better conversions</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium border transition-all ${
                      form.languages.includes(lang)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {form.languages.includes(lang) && <CheckCircle className="h-3.5 w-3.5 inline mr-1" />}
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="referralCode"
                value={form.referralCode}
                onChange={e => setForm(prev => ({ ...prev, referralCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. RAHUL01"
                className="font-mono uppercase tracking-wider"
              />
              <p className="text-xs text-muted-foreground">If another agent referred you, enter their code. This links your account so they earn Tier 2 commission when you convert leads — and you earn the same when you refer others.</p>
            </div>

            {/* Workspace unlock note */}
            <div className="rounded-lg bg-muted/50 border p-3">
              <p className="text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 inline mr-1 text-primary" />
                After signing up, you'll complete a short certification (6 modules, ~2 hours). Once certified, your full calling workspace and lead queue will be unlocked.
              </p>
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={submitting}>
              {submitting ? (
                <span className="animate-pulse-soft">Creating your account...</span>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Sign Up as Agent
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-primary hover:underline">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
