import React, { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, Lock, PlayCircle, BookOpen, ShieldCheck, ChevronDown, ChevronUp,
  Globe, Gift, Plane, Calculator, Wallet, Scale, Headset, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { trainingModules, PASS_THRESHOLD, FINAL_PASS_THRESHOLD } from '@/data/trainingModules';
import { ModuleContent } from '@/components/training/ModuleContent';
import { QuizSection } from '@/components/training/QuizSection';
import { CertificationBadge } from '@/components/training/CertificationBadge';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const iconMap: Record<string, React.ReactNode> = {
  globe: <Globe className="h-5 w-5" />,
  gift: <Gift className="h-5 w-5" />,
  plane: <Plane className="h-5 w-5" />,
  calculator: <Calculator className="h-5 w-5" />,
  wallet: <Wallet className="h-5 w-5" />,
  scale: <Scale className="h-5 w-5" />,
  headset: <Headset className="h-5 w-5" />,
  'shield-check': <ShieldCheck className="h-5 w-5" />,
};

type ModulePhase = 'content' | 'quiz';

export default function AgentTraining() {
  const { progress, allComplete, isLoading, markModulePassed, isModulePassed } = useTrainingProgress();
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [modulePhase, setModulePhase] = useState<Record<number, ModulePhase>>({});

  const totalModules = trainingModules.length;

  const getPhase = (moduleId: number): ModulePhase => modulePhase[moduleId] || 'content';

  const handleStartModule = (moduleId: number) => {
    setExpandedModule(moduleId);
    setModulePhase(prev => ({ ...prev, [moduleId]: 'content' }));
  };

  const handleStartQuiz = (moduleId: number) => {
    setModulePhase(prev => ({ ...prev, [moduleId]: 'quiz' }));
  };

  const handlePassQuiz = async (moduleId: number, score: number) => {
    await markModulePassed(moduleId, score);
    const mod = trainingModules.find(m => m.id === moduleId);
    if (moduleId === totalModules) {
      toast.success('🎉 Congratulations! You are now a certified Arena365 Calling Agent!');
    } else {
      toast.success(`Module ${moduleId} completed: ${mod?.title}`);
    }
    setExpandedModule(null);
  };

  const progressPercent = (progress / totalModules) * 100;

  const progressMessages = [
    'Start Module 1 to begin your certification journey.',
    'Great start! Keep going — 7 modules remaining.',
    'Good progress — you understand the core offers.',
    'Halfway through. The product knowledge is building.',
    'Strong progress — wagering rules are critical to master.',
    'Almost there — 3 modules left.',
    'Nearly certified — 2 more to go.',
    'Final assessment is next — review and pass to get certified.',
    'You\'re fully certified! Your workspace is now unlocked.',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading training progress…</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 flex-shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Arena365 Calling Agent Certification</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Complete all 8 training modules and pass each quiz to earn your certification.
              Your live calling workspace will remain locked until you pass the final assessment.
            </p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Certification Progress</h2>
            <p className="text-sm text-muted-foreground">{progress}/{totalModules} modules completed</p>
          </div>
          {allComplete ? (
            <div className="flex items-center gap-2 rounded-full bg-success/15 px-4 py-1.5 text-sm font-semibold text-success">
              <ShieldCheck className="h-4 w-4" /> Certified
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-warning/15 px-4 py-1.5 text-sm font-semibold text-warning">
              <Lock className="h-4 w-4" /> Workspace Locked
            </div>
          )}
        </div>
        <Progress value={progressPercent} className="h-2 mb-3" />
        <p className="text-sm text-muted-foreground">{progressMessages[progress] || ''}</p>
      </div>

      {/* Certification Badge */}
      {allComplete && <CertificationBadge />}

      {/* Warning banner */}
      {!allComplete && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-warning font-medium">
            ⚠️ Complete all 8 modules and pass each quiz to unlock live calling. This is mandatory before you can access leads.
          </p>
        </div>
      )}

      {/* Module List */}
      <div className="space-y-3">
        {trainingModules.map((mod) => {
          const isCompleted = isModulePassed(mod.id);
          const isNext = mod.id === progress + 1;
          const isLocked = mod.id > progress + 1;
          const isExpanded = expandedModule === mod.id;
          const phase = getPhase(mod.id);
          const isFinal = mod.id === totalModules;

          return (
            <div
              key={mod.id}
              className={cn(
                'rounded-lg border bg-card shadow-sm transition-all',
                isNext && 'border-primary/50 ring-1 ring-primary/20',
                isLocked && 'opacity-50'
              )}
            >
              <div
                className="flex items-center justify-between p-5 cursor-pointer"
                onClick={() => {
                  if (isLocked) return;
                  if (isExpanded) setExpandedModule(null);
                  else handleStartModule(mod.id);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                    isCompleted ? 'bg-success/15 text-success' :
                    isNext ? 'bg-primary/15 text-primary' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : iconMap[mod.icon] || mod.id}
                  </div>
                  <div>
                    <p className="font-medium">
                      {isFinal ? mod.title : `Module ${mod.id}: ${mod.title}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{mod.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{mod.duration}</span>
                  {isCompleted ? (
                    <span className="text-xs font-medium text-success">Passed ✓</span>
                  ) : isNext ? (
                    <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); handleStartModule(mod.id); }}>
                      <PlayCircle className="h-4 w-4 mr-1" /> {isExpanded ? '' : 'Start'}
                    </Button>
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {!isLocked && (
                    isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && !isLocked && (
                <div className="border-t px-5 pb-5 pt-4 space-y-5">
                  {phase === 'content' && (
                    <>
                      <ModuleContent module={mod} />
                      {(isNext || isCompleted) && (
                        <div className="flex justify-end">
                          <Button onClick={() => handleStartQuiz(mod.id)}>
                            {isCompleted ? 'Retake Quiz' : (isFinal ? 'Start Final Assessment' : 'Take Quiz')}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  {phase === 'quiz' && (
                    <>
                      <QuizSection
                        questions={mod.quiz}
                        passThreshold={isFinal ? FINAL_PASS_THRESHOLD : PASS_THRESHOLD}
                        onPass={(score) => handlePassQuiz(mod.id, score)}
                        moduleTitle={mod.title}
                        isFinalExam={isFinal}
                      />
                      <button
                        onClick={() => setModulePhase(prev => ({ ...prev, [mod.id]: 'content' }))}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        ← Back to lesson content
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
