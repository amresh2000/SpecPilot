import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { GenerateMorePanel } from '@/components/GenerateMorePanel';
import { EditableEpic } from '@/components/EditableEpic';
import { EditableStory } from '@/components/EditableStory';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse } from '@/types';

export const EpicsRefinementPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProceeding, setIsProceeding] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  const fetchStatus = async () => {
    if (!jobId) return;

    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setIsLoading(false);
    }
  };

  const handleProceedToFunctionalTests = async () => {
    if (!jobId) return;

    setIsProceeding(true);
    try {
      await api.proceedToStage(jobId, 'functional_tests');
      toast.success('Starting functional tests generation...');
      navigate(`/functional-tests/${jobId}`);
    } catch (error) {
      toast.error('Failed to proceed to functional tests');
      setIsProceeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading epics and stories...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Data not available</p>
      </div>
    );
  }

  const { results } = status;
  const isGenerating = status.current_stage === 'epics' &&
    status.stage_history.some(s => s.stage === 'epics' && s.status === 'running');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Epics & User Stories
          </h1>
          <p className="text-gray-600">
            Review, edit, and refine your generated epics and user stories
          </p>
        </div>

        {/* Stage Progress */}
        <StageProgressIndicator
          currentStage={status.current_stage || 'epics'}
          stageHistory={status.stage_history}
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">EPICs</h3>
            <p className="text-3xl font-bold text-blue-600">{results.epics.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">User Stories</h3>
            <p className="text-3xl font-bold text-green-600">{results.user_stories.length}</p>
          </div>
        </div>

        {/* Generate More Panel */}
        <div className="mb-6">
          <GenerateMorePanel
            jobId={jobId!}
            stage="epics"
            onGenerated={fetchStatus}
            placeholder="Example: Generate epics for user authentication and authorization flows..."
          />
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-blue-800">Generating epics and stories...</p>
            </div>
          </div>
        )}

        {/* Epics and Stories */}
        <div className="space-y-6 mb-6">
          {results.epics.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500">No epics generated yet. Please wait...</p>
            </div>
          ) : (
            results.epics.map((epic) => (
              <EditableEpic
                key={epic.id}
                epic={epic}
                jobId={jobId!}
                onUpdate={fetchStatus}
              >
                <div className="space-y-4 mt-4">
                  {results.user_stories
                    .filter((story) => story.epic_id === epic.id)
                    .map((story) => (
                      <EditableStory
                        key={story.id}
                        story={story}
                        jobId={jobId!}
                        onUpdate={fetchStatus}
                      />
                    ))}
                </div>
              </EditableEpic>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end items-center bg-white rounded-lg shadow-sm p-6">
          <Button
            onClick={handleProceedToFunctionalTests}
            disabled={isProceeding || results.epics.length === 0 || isGenerating}
            className="flex items-center gap-2"
          >
            {isProceeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Proceeding...
              </>
            ) : (
              <>
                Proceed to Functional Tests
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
