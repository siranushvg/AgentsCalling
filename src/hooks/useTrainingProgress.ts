import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { trainingModules } from '@/data/trainingModules';

interface ModuleProgress {
  module_id: number;
  passed: boolean;
  score: number | null;
  passed_at: string | null;
}

export function useTrainingProgress() {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const totalModules = trainingModules.length;

  // Derive progress count from passed modules
  const progress = modules.filter(m => m.passed).length;
  const allComplete = progress >= totalModules;

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setIsLoading(true);

      // Get agent ID
      const { data: aid } = await supabase.rpc('get_agent_id_for_user', { _user_id: user.id });
      if (aid) setAgentId(aid);

      // Get module progress
      const { data, error } = await supabase
        .from('agent_training_modules')
        .select('module_id, passed, score, passed_at')
        .order('module_id');

      if (!error && data) {
        setModules(data as ModuleProgress[]);
      }
      setIsLoading(false);
    };

    load();
  }, [user]);

  const markModulePassed = useCallback(async (moduleId: number, score: number) => {
    if (!agentId) return;

    const now = new Date().toISOString();

    // Upsert module progress
    const { error } = await supabase
      .from('agent_training_modules')
      .upsert({
        agent_id: agentId,
        module_id: moduleId,
        passed: true,
        score,
        passed_at: now,
      }, { onConflict: 'agent_id,module_id' });

    if (error) {
      toast.error('Failed to save progress');
      console.error(error);
      return;
    }

    // Update local state
    setModules(prev => {
      const existing = prev.find(m => m.module_id === moduleId);
      if (existing) {
        return prev.map(m => m.module_id === moduleId ? { ...m, passed: true, score, passed_at: now } : m);
      }
      return [...prev, { module_id: moduleId, passed: true, score, passed_at: now }];
    });

    // Update agents table progress
    const newProgress = modules.filter(m => m.passed).length + (modules.find(m => m.module_id === moduleId)?.passed ? 0 : 1);
    const completed = newProgress >= totalModules;

    await supabase
      .from('agents')
      .update({
        training_progress: newProgress,
        training_completed: completed,
        status: completed ? 'active' : 'training',
      })
      .eq('id', agentId);

  }, [agentId, modules, totalModules]);

  const isModulePassed = useCallback((moduleId: number) => {
    return modules.some(m => m.module_id === moduleId && m.passed);
  }, [modules]);

  return { progress, allComplete, isLoading, markModulePassed, isModulePassed, modules };
}
