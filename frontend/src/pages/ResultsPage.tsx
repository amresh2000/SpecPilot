import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { EditableEpic } from '@/components/EditableEpic';
import { EditableStory } from '@/components/EditableStory';
import { EditableFunctionalTest } from '@/components/EditableFunctionalTest';
import { EditableGherkinTest } from '@/components/EditableGherkinTest';
import { api } from '@/lib/api';
import { getSteps } from '@/lib/steps';
import type { StatusResponse } from '@/types';
import { Loader2, FileCode, Download, ArrowLeft } from 'lucide-react';

type ViewType = 'epics' | 'functional' | 'gherkin' | 'diagrams' | 'summary';

export const ResultsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('epics');
  const [loading, setLoading] = useState(true);
  const [generatingMoreTests, setGeneratingMoreTests] = useState<Record<string, boolean>>({});
  const [showInstructions, setShowInstructions] = useState<Record<string, boolean>>({});
  const [customInstructions, setCustomInstructions] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!jobId) return;

    try {
      const data = await api.getStatus(jobId);
      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [jobId]);

  const handleGenerateMoreTests = async (storyId: string) => {
    if (!jobId) return;

    try {
      setGeneratingMoreTests({ ...generatingMoreTests, [storyId]: true });
      setSuccessMessage(null);

      const instructions = customInstructions[storyId] || "";
      await api.generateMoreTests(jobId, storyId, instructions);

      // Refresh status to get new tests
      const data = await api.getStatus(jobId);
      setStatus(data);

      setSuccessMessage(`Successfully generated additional tests for story ${storyId}`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Hide instructions panel after success
      setShowInstructions({ ...showInstructions, [storyId]: false });
      setCustomInstructions({ ...customInstructions, [storyId]: "" });
    } catch (error) {
      console.error('Failed to generate more tests:', error);
      alert('Failed to generate additional tests. Please try again.');
    } finally {
      setGeneratingMoreTests({ ...generatingMoreTests, [storyId]: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status || status.status !== 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Results not available</p>
      </div>
    );
  }

  const { results } = status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Generated Results</h1>
          <p className="text-gray-600">{results.project_name}</p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8 bg-white rounded-lg p-6 shadow-sm">
          <ProgressStepper currentStep={3} steps={getSteps(status.artefacts)} />
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate(`/progress/${jobId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Progress
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex h-screen">
        {/* Left Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">{results.project_name}</h2>
            <p className="text-sm text-gray-600">Project Specifications</p>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'summary', label: 'Summary', count: null },
              { id: 'epics', label: 'EPICs', count: results.epics.length },
              { id: 'functional', label: 'Functional Tests', count: results.functional_tests.length },
              { id: 'gherkin', label: 'Gherkin Tests', count: results.gherkin_tests.length },
              { id: 'diagrams', label: 'Data Model & Diagrams', count: results.entities.length },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as ViewType)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
                {item.count !== null && (
                  <span className="ml-2 text-xs opacity-75">({item.count})</span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-6 space-y-2">
            {status.artefacts.code_skeleton && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/code/${jobId}`)}
              >
                <FileCode className="w-4 h-4 mr-2" />
                Code Skeleton
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => window.open(api.getDownloadUrl(jobId!), '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">EPICs</p>
                  <p className="text-3xl font-bold">{results.epics.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">User Stories</p>
                  <p className="text-3xl font-bold">{results.user_stories.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Functional Tests</p>
                  <p className="text-3xl font-bold">{results.functional_tests.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Gherkin Scenarios</p>
                  <p className="text-3xl font-bold">{results.gherkin_tests.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 mb-1">Entities</p>
                  <p className="text-3xl font-bold">{results.entities.length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeView === 'epics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">EPICs & User Stories</h2>
                <p className="text-sm text-gray-600">Click the edit icon to modify epics and stories</p>
              </div>
              {results.epics.map((epic) => (
                <EditableEpic
                  key={epic.id}
                  epic={epic}
                  jobId={jobId!}
                  onUpdate={fetchStatus}
                >
                  <div className="space-y-4">
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
              ))}
            </div>
          )}

          {activeView === 'functional' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Functional Tests</h2>
              {results.functional_tests.map((test) => (
                <EditableFunctionalTest
                  key={test.id}
                  test={test}
                  jobId={jobId!}
                  onUpdate={fetchStatus}
                />
              ))}
            </div>
          )}

          {activeView === 'gherkin' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Gherkin Tests</h2>
              {results.gherkin_tests.map((scenario) => (
                <EditableGherkinTest
                  key={scenario.id}
                  scenario={scenario}
                  jobId={jobId!}
                  onUpdate={fetchStatus}
                />
              ))}
            </div>
          )}

          {activeView === 'diagrams' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Data Model</h2>

              {/* Entities Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Entities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {results.entities.map((entity) => (
                      <div key={entity.name}>
                        <h4 className="font-semibold text-gray-900 mb-2">{entity.name}</h4>
                        <p className="text-sm text-gray-600 mb-3">{entity.description}</p>
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
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Mermaid Diagram */}
              {results.mermaid && (
                <Card>
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
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
