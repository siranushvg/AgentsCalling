import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}

export function DetailDrawer({ open, onClose, title, subtitle, children, width = 'w-[480px]' }: DetailDrawerProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      
      {/* Drawer */}
      <div className={cn(
        'fixed top-0 right-0 z-50 h-full border-l bg-card shadow-2xl transition-transform duration-200',
        width,
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-65px)] p-6">
          {children}
        </div>
      </div>
    </>
  );
}
