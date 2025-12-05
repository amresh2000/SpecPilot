import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse } from '@/types';

export const DataModelPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

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

  const handleGenerateCode = async () => {
    if (!jobId) return;

    setIsGeneratingCode(true);
    try {
      const response = await api.proceedToStage(jobId, 'code_generation');

      // Check if already completed
      if (response.status === 'already_completed') {
        toast.info('Code skeleton already generated');
        setIsGeneratingCode(false);
        navigate(`/code/${jobId}`);
        return;
      }

      toast.success('Starting code skeleton generation...');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const data = await api.getStatus(jobId);
        if (data.current_stage === 'completed' ||
            data.stage_history.some(s => s.stage === 'code_generation' && s.status === 'completed')) {
          clearInterval(pollInterval);
          toast.success('Code generation complete!');
          fetchStatus();
          setIsGeneratingCode(false);
        }
      }, 3000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsGeneratingCode(false);
        toast.warning('Code generation is taking longer than expected. Please check the code skeleton page.');
      }, 300000);
    } catch (error) {
      toast.error('Failed to generate code');
      setIsGeneratingCode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading data model...</p>
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
  const isGenerating = status.current_stage === 'data_model' &&
    status.stage_history.some(s => s.stage === 'data_model' && s.status === 'running');
  const codeGenerated = results.code_tree && results.code_tree.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Data Model & Entities
          </h1>
          <p className="text-gray-600">
            Review your generated data model and entity relationships
          </p>
        </div>

        {/* Stage Progress */}
        <StageProgressIndicator
          currentStage={status.current_stage || 'data_model'}
          stageHistory={status.stage_history}
        />

        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Entities</h3>
          <p className="text-3xl font-bold text-purple-600">{results.entities.length}</p>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <p className="text-blue-800">Generating data model...</p>
            </div>
          </div>
        )}

        {/* Entities */}
        <div className="space-y-6 mb-6">
          {results.entities.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-500">No entities generated yet. Please wait...</p>
            </div>
          ) : (
            results.entities.map((entity) => (
              <Card key={entity.name}>
                <CardHeader>
                  <CardTitle>{entity.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{entity.description}</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Field Name
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Type
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Required
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {entity.fields.map((field, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">{field.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{field.type}</td>
                            <td className="px-4 py-2 text-sm">
                              {field.required ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Mermaid Diagram */}
        {results.mermaid && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Entity Relationship Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto">
                {results.mermaid}
              </pre>
              <p className="text-xs text-gray-500 mt-2">
                Copy this Mermaid code to visualize the ER diagram using Mermaid Live Editor
              </p>
            </CardContent>
          </Card>
        )}

        {/* Code Generation Status */}
        {codeGenerated && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-green-800 font-medium">Code skeleton generated!</p>
                <p className="text-green-700 text-sm">
                  Your code skeleton is ready for download
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between items-center bg-white rounded-lg shadow-sm p-6">
          <Button
            variant="outline"
            onClick={() => navigate(`/gherkin-tests/${jobId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Gherkin Tests
          </Button>

          {!codeGenerated && status.artefacts.code_skeleton && (
            <Button
              onClick={handleGenerateCode}
              disabled={isGeneratingCode || results.entities.length === 0 || isGenerating}
              className="flex items-center gap-2"
            >
              {isGeneratingCode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Code...
                </>
              ) : (
                <>
                  Generate Code Skeleton
                </>
              )}
            </Button>
          )}

          {codeGenerated && (
            <Button
              onClick={() => navigate(`/code/${jobId}`)}
              className="flex items-center gap-2"
            >
              View Code Skeleton
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
