import React, { useState } from 'react';
import { CallingModeSelector, type CallingMode } from '@/components/calling/CallingModeSelector';
import ManualCallingMode from './ManualCallingMode';
import QueueCallingMode from './QueueCallingMode';
import CampaignCallingMode from './CampaignCallingMode';
import IncomingCallsMode from './IncomingCallsMode';
import { SoftphonePanel } from '@/components/calling/SoftphonePanel';

export default function AgentCallingHub() {
  const [mode, setMode] = useState<CallingMode>('manual');
  const [softphoneCollapsed, setSoftphoneCollapsed] = useState(false);

  return (
    <div className="flex h-[calc(100vh-8rem)] -mt-2 gap-3">
      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Calling Operations</h1>
          <CallingModeSelector mode={mode} onChange={setMode} />
        </div>

        <div className="flex-1 min-h-0">
          {mode === 'manual' && <ManualCallingMode />}
          {mode === 'queue' && <QueueCallingMode />}
          {mode === 'campaign' && <CampaignCallingMode />}
          {mode === 'incoming' && <IncomingCallsMode />}
        </div>
      </div>

      {/* Softphone panel - UI only, iframe persists in context */}
      <SoftphonePanel
        className={softphoneCollapsed ? 'w-48 shrink-0 self-start' : 'w-[340px] shrink-0'}
        collapsed={softphoneCollapsed}
        onToggleCollapse={() => setSoftphoneCollapsed(c => !c)}
      />
    </div>
  );
}
