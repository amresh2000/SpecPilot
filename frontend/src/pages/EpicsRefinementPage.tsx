import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { GenerateMorePanel } from '@/components/GenerateMorePanel';
import { EditableEpic } from '@/components/EditableEpic';
import { EditableStory } from '@/components/EditableStory';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse, CoverageReport } from '@/types';

export const EpicsRefinementPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();
  const toast     = useToast();

  const [status,       setStatus]       = useState<StatusResponse | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isProceeding, setIsProceeding] = useState(false);
  const [coverage,     setCoverage]     = useState<CoverageReport | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [jobId]);

  const fetchStatus = async () => {
    if (!jobId) return;
    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setIsLoading(false);
      const stageRunning = data.stage_history.some(s => s.status === 'running');
      if (!stageRunning && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (data.results.user_stories.length > 0 && data.results.atomic_requirements.length > 0) {
        try { setCoverage(await api.getCoverage(jobId)); } catch { /* non-blocking */ }
      }
    } catch {
      setIsLoading(false);
    }
  };

  const handleGenerateMissingStories = async () => {
    if (!jobId || !coverage) return;
    try {
      await api.generateMore(jobId, {
        stage: 'epics',
        instructions: `Generate user stories to cover these uncovered atomic requirement IDs: ${coverage.uncovered_req_ids.join(', ')}. Each story must include atomic_requirement_ids referencing at least one of these IDs.`,
      });
      toast.success('Generating stories for uncovered requirements…');
      if (!intervalRef.current) intervalRef.current = setInterval(fetchStatus, 3000);
    } catch {
      toast.error('Failed to generate missing stories');
    }
  };

  const handleProceedToFunctionalTests = async () => {
    if (!jobId) return;
    setIsProceeding(true);
    try {
      await api.proceedToStage(jobId, 'functional_tests');
      toast.success('Starting functional tests generation…');
      navigate(`/workspace/${jobId}`);
    } catch {
      toast.error('Failed to proceed to functional tests');
      setIsProceeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-neutral-600 text-sm">Loading epics and stories…</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-500">Data not available</p>
      </div>
    );
  }

  const { results } = status;
  const isGenerating = status.current_stage === 'epics' &&
    status.stage_history.some(s => s.stage === 'epics' && s.status === 'running');

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-1">Epics &amp; User Stories</h1>
          <p className="text-neutral-500 text-sm">Review, edit, and refine your generated epics and user stories</p>
        </div>

        <StageProgressIndicator
          currentStage={status.current_stage || 'epics'}
          stageHistory={status.stage_history}
        />

        {/* Coverage Banner */}
        {coverage && coverage.total > 0 && (
          <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${
            coverage.coverage_pct === 100
              ? 'bg-emerald-50 border-emerald-200'
              : coverage.coverage_pct >= 70
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {coverage.coverage_pct === 100
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              <span className="text-sm text-neutral-700">
                <span className="font-semibold">{coverage.coverage_pct}%</span> coverage ·{' '}
                {coverage.covered_req_ids.length}/{coverage.total} requirements covered
                {coverage.uncovered_req_ids.length > 0 && (
                  <span className="text-red-500 ml-1">· {coverage.uncovered_req_ids.length} uncovered</span>
                )}
              </span>
            </div>
            {coverage.uncovered_req_ids.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleGenerateMissingStories}>
                Generate Missing Stories
              </Button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-neutral-500 mb-1">EPICs</p>
              <p className="text-3xl font-bold text-indigo-600">{results.epics.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-neutral-500 mb-1">User Stories</p>
              <p className="text-3xl font-bold text-emerald-600">{results.user_stories.length}</p>
            </CardContent>
          </Card>
        </div>

        <GenerateMorePanel
          jobId={jobId!}
          stage="epics"
          onGenerated={fetchStatus}
          placeholder="Example: Generate epics for user authentication and authorization flows…"
        />

        {/* Generating state */}
        {isGenerating && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            <p className="text-sm text-indigo-800">Generating epics and stories…</p>
          </div>
        )}

        {/* Epics list */}
        <div className="space-y-4">
          {results.epics.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-14 text-center">
              <Layers className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="font-medium text-neutral-500">No epics generated yet</p>
              <p className="text-sm text-neutral-400 mt-1">Results will appear here once generation completes</p>
            </div>
          ) : (
            results.epics.map(epic => (
              <EditableEpic key={epic.id} epic={epic} jobId={jobId!} onUpdate={fetchStatus}>
                <div className="space-y-3 mt-3">
                  {results.user_stories
                    .filter(story => story.epic_id === epic.id)
                    .map(story => (
                      <EditableStory key={story.id} story={story} jobId={jobId!} onUpdate={fetchStatus} />
                    ))}
                </div>
              </EditableEpic>
            ))
          )}
        </div>

        {/* Action bar */}
        <div className="flex justify-end items-center bg-white rounded-xl border border-neutral-200 shadow-card px-5 py-4">
          <Button
            onClick={handleProceedToFunctionalTests}
            disabled={isProceeding || results.epics.length === 0 || isGenerating}
            className="flex items-center gap-2"
          >
            {isProceeding
              ? <><Loader2 className="w-4 h-4 animate-spin" />Proceeding…</>
              : <>Generate Functional Tests<ArrowRight className="w-4 h-4" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
};
