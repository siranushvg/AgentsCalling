import React from 'react';
import { mockQAScorecards, mockAgents, mockCalls } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';

export default function TeamLeadQA() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">QA Scorecards</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Opening</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Script</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Objections</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Closing</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Compliance</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-2 text-center font-medium text-muted-foreground">Flagged</th>
            </tr>
          </thead>
          <tbody>
            {mockQAScorecards.map(qa => (
              <tr key={qa.id} className="border-b hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium">{mockAgents.find(a => a.id === qa.agent_id)?.full_name}</td>
                <td className="px-4 py-2.5 text-center">{qa.opening}/10</td>
                <td className="px-4 py-2.5 text-center">{qa.script_adherence}/10</td>
                <td className="px-4 py-2.5 text-center">{qa.objection_handling}/10</td>
                <td className="px-4 py-2.5 text-center">{qa.closing}/10</td>
                <td className="px-4 py-2.5 text-center">{qa.compliance}/10</td>
                <td className="px-4 py-2.5 text-center font-semibold">{qa.total}/50</td>
                <td className="px-4 py-2.5 text-center">
                  {qa.flagged_for_admin ? <StatusBadge variant="high">Flagged</StatusBadge> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
