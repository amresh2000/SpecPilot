import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Download, CheckCircle2, Home, FileText, TestTube, Database, Code } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StageProgressIndicator } from '@/components/StageProgressIndicator';
import { useToast } from '@/components/ui/ToastContainer';
import { api } from '@/lib/api';
import type { StatusResponse } from '@/types';

export const SummaryPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
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

  const handleDownload = () => {
    if (!jobId) return;
    window.open(api.getDownloadUrl(jobId), '_blank');
    toast.success('Download started!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading summary...</p>
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

  // Count code files
  const countCodeFiles = (nodes: any[]): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file') {
        count++;
      } else if (node.type === 'folder' && node.children) {
        count += countCodeFiles(node.children);
      }
    }
    return count;
  };

  const codeFilesCount = results.code_tree ? countCodeFiles(results.code_tree) : 0;

  const metrics = [
    {
      label: 'EPICs',
      count: results.epics.length,
      icon: FileText,
      color: 'blue',
      description: 'High-level feature groupings'
    },
    {
      label: 'User Stories',
      count: results.user_stories.length,
      icon: FileText,
      color: 'green',
      description: 'Detailed user requirements'
    },
    {
      label: 'Functional Tests',
      count: results.functional_tests.length,
      icon: TestTube,
      color: 'purple',
      description: 'Manual test scenarios'
    },
    {
      label: 'Gherkin Scenarios',
      count: results.gherkin_tests.length,
      icon: TestTube,
      color: 'orange',
      description: 'BDD test scenarios'
    },
    {
      label: 'Data Entities',
      count: results.entities.length,
      icon: Database,
      color: 'pink',
      description: 'Data model entities'
    },
    {
      label: 'Code Files',
      count: codeFilesCount,
      icon: Code,
      color: 'indigo',
      description: 'Generated Java files'
    }
  ];

  const totalArtifacts = metrics.reduce((sum, metric) => sum + metric.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Generation Complete!
          </h1>
          <p className="text-gray-600">
            Summary of all generated artifacts for {results.project_name}
          </p>
        </div>

        {/* Stage Progress */}
        <StageProgressIndicator
          currentStage={status.current_stage || 'completed'}
          stageHistory={status.stage_history}
        />

        {/* Completion Banner */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-500 rounded-full p-3">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-green-900 mb-1">
                All Done!
              </h2>
              <p className="text-green-700">
                Successfully generated {totalArtifacts} artifacts across all pipeline stages
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        {metric.label}
                      </p>
                      <p className={`text-4xl font-bold text-${metric.color}-600 mb-2`}>
                        {metric.count}
                      </p>
                      <p className="text-xs text-gray-500">
                        {metric.description}
                      </p>
                    </div>
                    <div className={`bg-${metric.color}-100 rounded-lg p-3`}>
                      <Icon className={`w-6 h-6 text-${metric.color}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Project Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Project Name</p>
                <p className="text-lg font-semibold text-gray-900">{results.project_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Job ID</p>
                <p className="text-lg font-mono text-gray-700">{jobId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Framework</p>
                <p className="text-lg text-gray-900">Java Selenium + Cucumber</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-lg font-semibold text-green-600">Completed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="default"
            size="lg"
            onClick={handleDownload}
            className="px-8 py-4 text-lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Download Complete Project ZIP
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/')}
            className="px-8 py-4 text-lg"
          >
            <Home className="w-5 h-5 mr-2" />
            Start New Project
          </Button>
        </div>
      </div>
    </div>
  );
};
