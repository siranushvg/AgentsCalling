import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoicelay } from '@/contexts/VoicelayContext';

interface SoftphonePanelProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SoftphonePanel({ className, collapsed = false, onToggleCollapse }: SoftphonePanelProps) {
  const {
    connectionState,
    isSoftphoneReady,
    hasIframeSrc,
    virtualNumber,
    agentName,
    error,
    booting,
    handleReload,
    attachSoftphoneHost,
    iframeRef,
  } = useVoicelay();

  // CRITICAL: This ref callback attaches the iframe portal host.
  // It must ALWAYS be called — never gated behind early returns — to prevent
  // the browser from reloading the iframe when the portal mount reparents,
  // which kills the active WebRTC/SIP session during navigation.
  const handleHostRef = useCallback((node: HTMLDivElement | null) => {
    attachSoftphoneHost(node);
  }, [attachSoftphoneHost]);

  const isLoading = connectionState === 'loading' && !iframeRef.current?.src;
  const isError = !!(error || connectionState === 'error');
  const showExpanded = !isLoading && !isError && !collapsed;

  return (
    <div className={cn('relative', className)}>
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading softphone...
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-4 gap-2">
          <PhoneOff className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">{error || 'Softphone not available'}</p>
        </div>
      )}

      {/* Collapsed state */}
      {collapsed && !isLoading && !isError && (
        <div className="relative rounded-lg border bg-card p-2">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center">
              <Phone className="h-3 w-3 text-success" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{isSoftphoneReady ? 'Softphone Active' : 'Connecting Softphone'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{virtualNumber || agentName}</p>
            </div>
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Expanded card chrome — header bar */}
      {showExpanded && (
        <div className="rounded-t-lg border border-b-0 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
                <Phone className="h-3 w-3 text-success" />
              </div>
              <div>
                <p className="text-xs font-medium">Voicelay Softphone</p>
                {virtualNumber && (
                  <p className="text-[10px] text-muted-foreground font-mono">{virtualNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] text-success border-success/30">
                {isSoftphoneReady ? 'Connected' : 'Connecting'}
              </Badge>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReload} title="Reload softphone" disabled={booting}>
                <RefreshCw className={cn('h-3 w-3', booting && 'animate-spin')} />
              </Button>
              {onToggleCollapse && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCollapse} title="Minimize">
                  <Minimize2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/*
        CRITICAL: The iframe portal host div MUST always remain mounted in the
        DOM tree. Moving an iframe's parent element causes the browser to reload
        the iframe, destroying the active WebRTC/SIP call. When collapsed,
        loading, or in error state, we park it off-screen instead of unmounting.
      */}
      <div
        ref={handleHostRef}
        className={cn(
          showExpanded
            ? 'relative w-full rounded-b-lg border border-t-0 bg-card overflow-hidden'
            : 'fixed -left-[9999px] top-0 h-[560px] w-[340px] opacity-0 pointer-events-none',
        )}
        style={showExpanded ? { minHeight: '500px' } : undefined}
      >
        {/* Overlays for loading/connecting states inside the iframe area */}
        {showExpanded && !hasIframeSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading softphone...
            </div>
          </div>
        )}
        {showExpanded && hasIframeSrc && !isSoftphoneReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/90">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {iframeRef.current?.src ? 'Waiting for WebRTC registration...' : 'Connecting softphone...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
