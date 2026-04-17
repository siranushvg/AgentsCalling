import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function CertificationBadge() {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-6 text-center space-y-4">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
        <ShieldCheck className="h-10 w-10 text-success" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Arena365 Certified Agent</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You have successfully completed all 8 training modules and passed the final certification assessment.
        </p>
      </div>
      <div className="rounded-lg bg-success/10 p-3">
        <p className="text-sm text-success font-medium">
          ✓ Your live calling workspace is now unlocked. You can start taking real calls.
        </p>
      </div>
      <Button onClick={() => navigate('/agent/workspace')} className="w-full">
        Go to Calling Workspace <ExternalLink className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
