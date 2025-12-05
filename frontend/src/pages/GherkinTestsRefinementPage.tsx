import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { GenerateMorePanel } from '@/components/GenerateMorePanel';
import { EditableGherkinTest } from '@/components/EditableGherkinTest';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse } from '@/types';

export const GherkinTestsRefinementPage: React.FC = () => {
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

  const handleProceedToDataModel = async () => {
    if (!jobId) return;

    setIsProceeding(true);
    try {
      await api.proceedToStage(jobId, 'data_model');
      toast.success('Starting data model generation...');
      navigate(`/data-model/${jobId}`);
    } catch (error) {
      toast.error('Failed to proceed to data model');
      setIsProceeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Gherkin tests...</p>
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
  const isGenerating = status.current_stage === 'gherkin_tests' &&
    status.stage_history.some(s => s.stage === 'gherkin_tests' && s.status === 'running');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Gherkin BDD Scenarios
          </h1>
          <p className="text-gray-600">
            Review, edit, and refine your generated Gherkin test scenarios
          </p>
        </div>

        {/* Stage Progress */}
        <StageProgressIndicator
          currentStage={status.current_stage || 'gherkin_tests'}
          stageHistory={status.stage_history}
        />

        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Gherkin Scenarios</h3>
          <p className="text-3xl font-bold text-green-600">{results.gherkin_tests.length}</p>
        </div>

        {/* Generate More Panel */}
        <div className="mb-6">
          <GenerateMorePanel
            jobId={jobId!}
            stage="gherkin_tests"
            onGenerated={fetchStatus}
            placeholder="Example: Generate additional scenarios for error handling and negative test cases..."
          />
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-blue-800">Generating Gherkin scenarios...</p>
            </div>
          </div>
        )}

        {/* Gherkin Tests */}
        <div className="space-y-6 mb-6">
          {results.gherkin_tests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500">No Gherkin scenarios generated yet. Please wait...</p>
            </div>
          ) : (
            results.gherkin_tests.map((scenario) => (
              <EditableGherkinTest
                key={scenario.id}
                scenario={scenario}
                jobId={jobId!}
                onUpdate={fetchStatus}
              />
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between items-center bg-white rounded-lg shadow-sm p-6">
          <Button
            variant="outline"
            onClick={() => navigate(`/functional-tests/${jobId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Functional Tests
          </Button>
          <Button
            onClick={handleProceedToDataModel}
            disabled={isProceeding || results.gherkin_tests.length === 0 || isGenerating}
            className="flex items-center gap-2"
          >
            {isProceeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Proceeding...
              </>
            ) : (
              <>
                Proceed to Data Model
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
