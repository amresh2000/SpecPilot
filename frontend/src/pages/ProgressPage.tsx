import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { useToast } from '@/components/ui/ToastContainer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import { getSteps } from '@/lib/steps';
import { formatDuration } from '@/lib/utils';
import type { StatusResponse, Step as StepType, ArtefactsConfig } from '@/types';
import { CheckCircle2, Circle, Loader2, XCircle, Download, FileText, ArrowLeft } from 'lucide-react';

interface UploadState {
  file: File;
  instructions: string;
  artefacts: ArtefactsConfig;
}

export const ProgressPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const uploadState = location.state as UploadState | null;
  const toast = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>('Uploading document...');
  const [isUploading, setIsUploading] = useState(jobId === 'uploading');
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  // Handle file upload when in "uploading" mode
  useEffect(() => {
    if (jobId === 'uploading' && uploadState) {
      const performUpload = async () => {
        try {
          // Start upload
          setUploadProgress('Uploading document...');

          // Small delay to ensure UI renders
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await api.generate(uploadState.file, {
            instructions: uploadState.instructions,
            artefacts: uploadState.artefacts
          });

          setUploadProgress('Upload complete, starting generation...');
          setIsUploading(false);
          toast.success('Document uploaded successfully! Generation started.');

          // Replace URL with actual job ID without losing the page
          navigate(`/progress/${response.job_id}`, { replace: true });
        } catch (error: any) {
          console.error('Upload failed:', error);
          const errorMsg = error.response?.data?.detail || error.message || 'Upload failed';
          setUploadProgress(`Upload failed: ${errorMsg}`);
          toast.error(`Upload failed: ${errorMsg}`);
          setLoading(false);
        }
      };

      performUpload();
    }
  }, [jobId, uploadState, navigate]);

  // Poll for status updates when we have a real job ID
  useEffect(() => {
    if (!jobId || jobId === 'uploading') return;

    const fetchStatus = async () => {
      try {
        const data = await api.getStatus(jobId);
        setStatus(data);

        // Show completion toast when status changes to completed
        if (data.status === 'completed' && loading) {
          toast.success('Generation completed successfully!');
        } else if (data.status === 'failed' && loading) {
          toast.error('Generation failed. Please check the error details.');
        }

        // Only stop loading after first successful fetch
        if (loading) {
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Failed to fetch status:', error);
        // Show error toast only once when first fetch fails
        if (loading) {
          toast.error('Failed to load generation status. Retrying...');
        }
        // Don't stop loading on error - keep trying
      }
    };

    // Fetch immediately
    fetchStatus();
    // Then poll every 2 seconds (reduced frequency to avoid overwhelming the server)
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  const getStepIcon = (step: StepType) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400 animate-pulse" />;
    }
  };

  const handleDownload = () => {
    if (jobId) {
      window.open(api.getDownloadUrl(jobId), '_blank');
      toast.success('Download started!');
    }
  };

  const handleBackToConfig = () => {
    if (status?.status === 'running' || status?.status === 'processing') {
      setShowBackConfirm(true);
    } else {
      navigate('/');
    }
  };

  const confirmBackToConfig = () => {
    setShowBackConfirm(false);
    toast.warning('Navigation cancelled the active generation.');
    navigate('/');
  };

  // Show upload progress when in uploading mode
  if (isUploading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Generation Progress</h1>
            <p className="text-gray-600">Preparing your document...</p>
          </div>

          {uploadState && (
            <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
              <ProgressStepper currentStep={2} steps={getSteps(uploadState.artefacts)} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <p className="text-lg font-semibold">Uploading</p>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Generation Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{uploadProgress}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show minimal loading only if we have absolutely no data yet
  if (!status && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading generation status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Job not found</p>
      </div>
    );
  }

  const isCompleted = status.status === 'completed';
  const isFailed = status.status === 'failed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Generation Progress</h1>
          <p className="text-gray-600">
            {status.results.project_name || 'Processing your BRD document...'}
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
          <ProgressStepper currentStep={2} steps={getSteps(status.artefacts)} />
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={handleBackToConfig}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Configuration
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showBackConfirm}
          title="Leave Generation in Progress?"
          message="Going back will cancel the current generation process. Any progress will be lost. Are you sure you want to continue?"
          confirmText="Yes, Leave"
          cancelText="Stay Here"
          variant="warning"
          onConfirm={confirmBackToConfig}
          onCancel={() => setShowBackConfirm(false)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Status</p>
                <div className="inline-flex items-center">
                  {status.status === 'completed' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full border border-green-200">
                      ✓ Completed
                    </span>
                  )}
                  {(status.status === 'running' || status.status === 'processing') && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full border border-blue-200 flex items-center">
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Processing
                    </span>
                  )}
                  {status.status === 'failed' && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded-full border border-red-200">
                      ✕ Failed
                    </span>
                  )}
                  {status.status === 'pending' && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-semibold rounded-full border border-gray-200">
                      ○ Pending
                    </span>
                  )}
                </div>
              </div>

              {isCompleted && (
                <>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">EPICs</p>
                    <p className="text-2xl font-bold">{status.results.epics.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">User Stories</p>
                    <p className="text-2xl font-bold">{status.results.user_stories.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Functional Tests</p>
                    <p className="text-2xl font-bold">{status.results.functional_tests.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Gherkin Tests</p>
                    <p className="text-2xl font-bold">{status.results.gherkin_tests.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Entities</p>
                    <p className="text-2xl font-bold">{status.results.entities.length}</p>
                  </div>
                </>
              )}

              {isFailed && status.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {status.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Progress Steps */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generation Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {status.steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="mt-0.5">{getStepIcon(step)}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{step.name}</p>
                        {step.duration_ms !== undefined && step.duration_ms > 0 && (
                          <p className="text-xs text-gray-500">
                            {formatDuration(step.duration_ms)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isCompleted && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button onClick={() => navigate(`/results/${jobId}`)}>
                      <FileText className="w-4 h-4 mr-2" />
                      View Generated Results
                    </Button>
                    <Button variant="outline" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download ZIP
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/')}>
                      New Generation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
