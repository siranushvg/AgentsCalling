import React from 'react';
import { TrainingModule } from '@/data/trainingModules';
import { BookOpen, Target, Lightbulb } from 'lucide-react';

interface ModuleContentProps {
  module: TrainingModule;
}

export function ModuleContent({ module }: ModuleContentProps) {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{module.intro}</p>
      </div>

      {/* Lessons */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" /> Lessons
        </h4>
        {module.lessons.map((lesson, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold">{lesson.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{lesson.content}</p>
          </div>
        ))}
      </div>

      {/* Examples */}
      {module.examples && module.examples.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5" /> Examples
          </h4>
          {module.examples.map((ex, i) => (
            <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
              <p className="text-sm font-semibold text-primary">{ex.label}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{ex.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Goal */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
        <Target className="h-4 w-4 text-accent-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Module Goal</p>
          <p className="text-sm text-foreground leading-relaxed">{module.goal}</p>
        </div>
      </div>
    </div>
  );
}
