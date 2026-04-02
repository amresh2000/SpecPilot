import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar';
import { EpicStorySidebar } from '@/components/workspace/EpicStorySidebar';
import { GenerationBanner } from '@/components/workspace/GenerationBanner';
import { StoryDetailPanel } from '@/components/workspace/StoryDetailPanel';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse, WorkspacePhase } from '@/types';

function derivePhase(status: StatusResponse): WorkspacePhase {
  const history = status.stage_history;
  const ft = history.find(s => s.stage === 'functional_tests');
  const gh = history.find(s => s.stage === 'gherkin_tests');
  const dm = history.find(s => s.stage === 'data_model');

  if (!ft || ft.status === 'running') return 'generating_functional_tests';
  // If ft failed, fall through — show whatever was generated (may be partial or empty)
  if (ft.status === 'completed' && !gh) return 'functional_tests_ready';
  if (
    gh?.status === 'running' ||
    dm?.status === 'running' ||
    (gh?.status === 'completed' && dm?.status !== 'completed')
  ) return 'generating_gherkin';
  return 'complete';
  // Note: assumes artefacts.functional_tests === true (always true when entering via workspace flow)
}

export const WorkspacePage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const toast = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents duplicate auto-trigger of data_model across poll ticks
  const dataModelTriggeredRef = useRef(false);

  const fetchStatus = async () => {
    if (!jobId) return;
    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setIsLoading(false);

      // Auto-select first story on first load, don't override user's selection
      setSelectedStoryId(prev => {
        if (prev !== null) return prev;
        const firstEpic = data.results.epics[0];
        if (!firstEpic) return null;
        const firstStory = data.results.user_stories.find(s => s.epic_id === firstEpic.id);
        return firstStory?.id ?? null;
      });

      // Stop polling when fully complete or when the job has failed
      const phase = derivePhase(data);
      const jobFailed = data.status === 'failed';
      if (phase === 'complete' || jobFailed) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  // Auto-trigger data_model after gherkin completes
  useEffect(() => {
    if (!status || !jobId) return;
    const gh = status.stage_history.find(s => s.stage === 'gherkin_tests');
    const dm = status.stage_history.find(s => s.stage === 'data_model');

    if (gh?.status === 'completed' && !dm && !dataModelTriggeredRef.current) {
      dataModelTriggeredRef.current = true;
      api.proceedToStage(jobId, 'data_model').catch(() => {
        // Allow retry on next poll tick
        dataModelTriggeredRef.current = false;
      });
    }
  }, [status, jobId]);

  const handleGenerateGherkin = async () => {
    if (!jobId) return;
    setIsTriggering(true);
    try {
      await api.proceedToStage(jobId, 'gherkin_tests');
      toast.success('Generating Gherkin scenarios and data model...');
      // Restart polling if it was stopped (safety net)
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchStatus, 3000);
      }
    } catch {
      toast.error('Failed to start Gherkin generation');
    } finally {
      setIsTriggering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Derived state
  const phase = status ? derivePhase(status) : 'generating_functional_tests';
  const epics = status?.results.epics ?? [];
  const stories = status?.results.user_stories ?? [];
  const allFT = status?.results.functional_tests ?? [];
  const allGH = status?.results.gherkin_tests ?? [];
  const projectName = status?.results.project_name;

  const selectedStory = stories.find(s => s.id === selectedStoryId) ?? null;
  const selectedEpic = selectedStory
    ? epics.find(e => e.id === selectedStory.epic_id) ?? null
    : null;
  const storyFT = allFT.filter(t => t.story_id === selectedStoryId);
  const storyGH = allGH.filter(t => t.story_id === selectedStoryId);
  const storiesWithNoTests = stories.filter(
    s => allFT.filter(t => t.story_id === s.id).length === 0
  ).length;

  return (
    <div className="h-screen flex flex-col bg-white">
      <WorkspaceTopBar
        projectName={projectName}
        jobId={jobId!}
        isComplete={phase === 'complete'}
      />

      <div className="flex flex-1 overflow-hidden">
        <EpicStorySidebar
          epics={epics}
          stories={stories}
          functionalTests={allFT}
          gherkinTests={allGH}
          selectedStoryId={selectedStoryId}
          onSelectStory={setSelectedStoryId}
          phase={phase}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {phase !== 'complete' && (
            <div className="px-6 py-3 border-b border-gray-100 shrink-0">
              <GenerationBanner
                phase={phase}
                onGenerateGherkin={handleGenerateGherkin}
                isTriggering={isTriggering}
                functionalTestsCount={allFT.length}
                storiesWithNoTests={storiesWithNoTests}
              />
            </div>
          )}

          <StoryDetailPanel
            story={selectedStory}
            epic={selectedEpic}
            functionalTests={storyFT}
            gherkinTests={storyGH}
            jobId={jobId!}
            onUpdate={fetchStatus}
            phase={phase}
          />
        </div>
      </div>
    </div>
  );
};
